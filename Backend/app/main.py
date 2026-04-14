# app/main.py
from datetime import datetime, timedelta
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

logger = logging.getLogger("crime_tracer.main")

from .db import engine, get_db
from .models import Base, Complaint, ComplaintStatus, ComplaintStatusHistory, User, UserRole
from .config import settings
from . import auth, victim, stations, cases, admin, stats, uploads, cop_profile, otp, investigation, audit, patterns, forensics
from .utils.rate_limiter import get_rate_limiter, RATE_LIMITING_AVAILABLE
from .utils.metrics import (
    http_requests_total,
    http_request_duration_seconds,
)
from .utils.exceptions import CrimeTracerException
from .logging_config import setup_logging

# Setup logging
setup_logging(use_json=settings.ENV == "prod")
logger = logging.getLogger("crime_tracer.main")

# Database initialization
# In production, use Alembic migrations instead of create_all
if settings.ENV == "local" or settings.ENV == "dev":
    # Only create tables automatically in local/dev environments
    # In production, use: alembic upgrade head
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified")
    except Exception as e:
        logger.warning(f"Could not create all tables (some may already exist): {e}")
        logger.info("If you see column errors, run: python scripts/add_account_lockout_columns.py")
else:
    logger.info("Production environment detected. Use 'alembic upgrade head' to run migrations.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    import asyncio
    from .utils.metrics import active_complaints, active_users
    from .models import User, UserRole, Complaint, ComplaintStatus
    
    # Startup
    logger.info("Starting Crime Tracer Backend...")
    logger.info(f"Environment: {settings.ENV}")
    logger.info(f"Database: {settings.SQLALCHEMY_DATABASE_URL.split('@')[-1] if '@' in settings.SQLALCHEMY_DATABASE_URL else 'SQLite'}")
    
    # Start background tasks
    async def background_tasks():
        """Background tasks for auto-closing complaints and updating metrics."""
        while True:
            # Auto-close resolved complaints
            _auto_close_once()
            
            # Update active metrics
            try:
                db = next(get_db())
                try:
                    # Count active users by role
                    # Handle case where new columns might not exist in old database
                    try:
                        for role in UserRole:
                            count = db.query(User).filter(
                                User.role == role,
                                User.is_active == True
                            ).count()
                            active_users.labels(role=role.value).set(count)
                    except Exception as e:
                        logger.warning(f"Could not update user metrics (database may need migration): {e}")
                    
                    # Count active complaints by status
                    try:
                        for status in ComplaintStatus:
                            count = db.query(Complaint).filter(
                                Complaint.status == status
                            ).count()
                            active_complaints.labels(status=status.value).set(count)
                    except Exception as e:
                        logger.warning(f"Could not update complaint metrics: {e}")
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"Error updating metrics: {e}", exc_info=True)
            
            await asyncio.sleep(600)  # every 10 minutes
    
    task = asyncio.create_task(background_tasks())
    
    yield
    
    # Shutdown
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    logger.info("Shutting down Crime Tracer Backend...")


app = FastAPI(
    title="Crime Tracer Mangalore",
    version="1.0.0",
    lifespan=lifespan,
)


def _add_cors_to_response(response: Response, request: Request) -> None:
    """Ensure CORS headers are set so browser allows the response from any allowed origin."""
    origin = request.headers.get("origin")
    if not origin:
        return
    if origin in settings.allowed_origins or "*" in settings.allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin if origin in settings.allowed_origins else "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        if "Vary" not in response.headers:
            response.headers["Vary"] = "Origin"


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handle HTTPException and ensure CORS headers are always present."""
    response = JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    _add_cors_to_response(response, request)
    return response


# Rate limiting middleware
if RATE_LIMITING_AVAILABLE:
    limiter = get_rate_limiter()
    app.state.limiter = limiter
    
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        from slowapi.errors import RateLimitExceeded
        from .utils.exceptions import RateLimitError
        
        if isinstance(exc, RateLimitExceeded):
            retry_after = getattr(exc, "retry_after", None)
            rate_limit_error = RateLimitError(retry_after=retry_after)
            response = JSONResponse(
                status_code=rate_limit_error.status_code,
                content=rate_limit_error.to_dict()
            )
            if retry_after:
                response.headers["Retry-After"] = str(retry_after)
            _add_cors_to_response(response, request)
            return response
        
        # Handle custom exceptions
        if isinstance(exc, CrimeTracerException):
            logger.error(
                f"CrimeTracerException: {exc.error_code} - {exc.detail}",
                extra={"error_code": exc.error_code, "error_type": exc.error_type, "metadata": exc.metadata}
            )
            response = JSONResponse(
                status_code=exc.status_code,
                content=exc.to_dict()
            )
            _add_cors_to_response(response, request)
            return response
        
        # Log unexpected errors (but don't expose details in production)
        logger.exception(f"Unexpected error: {type(exc).__name__}: {str(exc)}")
        
        # In production, return generic error
        if settings.ENV == "prod":
            response = JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "code": "INTERNAL_ERROR",
                        "type": "internal",
                        "message": "An internal error occurred. Please try again later."
                    }
                }
            )
            _add_cors_to_response(response, request)
            return response
        
        # In development, re-raise for FastAPI's default handler
        raise exc
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Handle Pydantic validation errors."""
        from .utils.exceptions import ValidationError
        
        errors = exc.errors()
        error_messages = [f"{err['loc']}: {err['msg']}" for err in errors]
        detail = "; ".join(error_messages)
        
        validation_error = ValidationError(
            detail=detail,
            metadata={"validation_errors": errors}
        )
        response = JSONResponse(
            status_code=validation_error.status_code,
            content=validation_error.to_dict()
        )
        _add_cors_to_response(response, request)
        return response

# Metrics middleware (must be before CORS)
from starlette.middleware.base import BaseHTTPMiddleware

class MetricsMiddlewareWrapper(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        method = request.method
        path = self._normalize_path(request.url.path)
        start_time = time.time()
        
        response = await call_next(request)
        
        duration = time.time() - start_time
        status_code = response.status_code
        
        http_requests_total.labels(method=method, endpoint=path, status_code=status_code).inc()
        http_request_duration_seconds.labels(method=method, endpoint=path).observe(duration)
        
        return response
    
    def _normalize_path(self, path: str) -> str:
        """Normalize path to remove IDs and make it metric-friendly."""
        import re
        # Replace UUIDs
        path = re.sub(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '{id}', path)
        # Replace numeric IDs
        path = re.sub(r'/\d+', '/{id}', path)
        # Replace complaint IDs (CTM-...)
        path = re.sub(r'/CTM-[A-Z0-9-]+', '/{complaint_id}', path)
        return path

app.add_middleware(MetricsMiddlewareWrapper)

# CORS – using settings.allowed_origins (loads from Backend/.env; local/dev always gets 4173/5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Ensure CORS headers on every response (e.g. when 500 or auth errors bypass normal CORS)
class EnsureCORSHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        origin = request.headers.get("origin")
        if origin and "Access-Control-Allow-Origin" not in response.headers:
            if origin in settings.allowed_origins or "*" in settings.allowed_origins:
                response.headers["Access-Control-Allow-Origin"] = origin if origin in settings.allowed_origins else "*"
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Vary"] = "Origin"
        return response


app.add_middleware(EnsureCORSHeadersMiddleware)


# Routers
try:
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(victim.router, prefix="/api/victim", tags=["victim"])
    app.include_router(stations.router, prefix="/api/stations", tags=["stations"])
    app.include_router(cases.router, prefix="/api/cases", tags=["cases"])
    app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
    app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
    app.include_router(uploads.router, prefix="/api/uploads", tags=["uploads"])
    app.include_router(cop_profile.router, prefix="/api/cop", tags=["cop"])
    app.include_router(otp.router, prefix="/api/otp", tags=["otp"])
    app.include_router(investigation.router, prefix="/api/investigation", tags=["investigation"])
    app.include_router(audit.router, prefix="/api/investigation", tags=["audit"])
    app.include_router(patterns.router, prefix="/api/investigation", tags=["patterns"])
    app.include_router(forensics.router, prefix="/api/forensics", tags=["forensics"])
    logger.info("All routers registered successfully")
except Exception as e:
    logger.error(f"Error registering routers: {e}", exc_info=True)


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/api/health")
def health():
    """
    Health check endpoint with dependency status.
    Returns 200 if service is healthy, 503 if dependencies are unavailable.
    """
    from .db import engine
    from .config import settings
    
    health_status = {
        "status": "ok",
        "service": "crime-tracer-backend",
        "version": "1.0.0",
        "dependencies": {}
    }
    
    # Check database connection
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            conn.commit()
        health_status["dependencies"]["database"] = "healthy"
    except Exception as e:
        health_status["dependencies"]["database"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check ML service availability
    try:
        import httpx
        ml_url = settings.MODEL_SERVICE_URL.replace("/predict", "/health")
        response = httpx.get(ml_url, timeout=2.0)
        if response.status_code == 200:
            health_status["dependencies"]["ml_service"] = "healthy"
        else:
            health_status["dependencies"]["ml_service"] = "unavailable"
            health_status["status"] = "degraded"
    except Exception:
        health_status["dependencies"]["ml_service"] = "unavailable"
        health_status["status"] = "degraded"
    
    # Check S3 availability (if configured)
    if settings.AWS_ACCESS_KEY_ID and settings.S3_BUCKET_NAME:
        try:
            import boto3
            s3 = boto3.client("s3", 
                           aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                           aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                           region_name=settings.AWS_REGION)
            s3.head_bucket(Bucket=settings.S3_BUCKET_NAME)
            health_status["dependencies"]["s3"] = "healthy"
        except Exception:
            health_status["dependencies"]["s3"] = "unavailable (fallback to local)"
    
    status_code = 200 if health_status["status"] == "ok" else 503
    return health_status


# ---------- Auto-close background task ----------

def _auto_close_once():
    """One-pass auto-close sweep: RESOLVED -> CLOSED if >24h and no victim response."""
    db = next(get_db())
    try:
        cutoff = datetime.utcnow() - timedelta(hours=24)
        to_close = (
            db.query(Complaint)
            .filter(
                Complaint.status == ComplaintStatus.RESOLVED,
                Complaint.resolved_at != None,  # noqa
                Complaint.resolved_at <= cutoff,
            )
            .all()
        )

        for c in to_close:
            old_status = c.status
            c.status = ComplaintStatus.CLOSED
            c.closed_at = datetime.utcnow()
            c.updated_at = datetime.utcnow()

            hist = ComplaintStatusHistory(
                complaint_id=c.id,
                status=c.status,
                changed_by_id=None,
                reason="Auto-closed after 24h without victim response",
            )
            db.add(hist)

            logger.info(
                "Auto-closed complaint %s (prev=%s)", c.complaint_id, old_status.value
            )

        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Auto-close job failed: {e}", exc_info=True)
    finally:
        db.close()


# Background tasks are handled in lifespan context manager
# This function is kept for backward compatibility but tasks are started in lifespan