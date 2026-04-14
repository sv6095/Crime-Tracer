# Deployment Guide

This guide covers deployment options for the Crime Tracer system.

## Prerequisites

- Docker and Docker Compose installed
- Environment variables configured
- Database access (Firebase Firestore or SQLite)
- AWS S3 credentials (optional, falls back to local storage)

## Environment Variables

Create a `.env` file in the `Backend/` directory:

```bash
# Application
ENV=production
SECRET_KEY=your-secure-secret-key-here

# Database
SQLALCHEMY_DATABASE_URL=sqlite:///./crime_tracer.db
# OR for Firebase:
# FIREBASE_CREDENTIALS_PATH=/path/to/firebase-credentials.json

# CORS
ALLOWED_ORIGINS_RAW=https://yourdomain.com,https://admin.yourdomain.com

# AWS S3 (optional)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# Grok API
GROK_API_KEY=your-grok-api-key

# ML Service
MODEL_SERVICE_URL=http://ml-service:8001/predict
```

## Docker Compose Deployment

### Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production

1. Update `docker-compose.yml` with production settings
2. Set environment variables
3. Use production database (Firebase)
4. Configure reverse proxy (nginx/traefik)
5. Set up SSL/TLS certificates

## Individual Service Deployment

### Backend API

```bash
cd Backend
docker build -t crime-tracer-backend .
docker run -p 8000:8000 \
  -e SECRET_KEY=your-secret \
  -e DATABASE_URL=your-db-url \
  crime-tracer-backend
```

### ML Service

```bash
cd Backend_Model
docker build -t crime-tracer-ml .
docker run -p 8001:8001 \
  -v $(pwd)/Model_Data:/app/Model_Data:ro \
  crime-tracer-ml
```

### Frontend Services

```bash
# Client Frontend
cd Client_Side_Frontend
docker build -t crime-tracer-client .
docker run -p 80:80 crime-tracer-client

# Server Frontend
cd Sever_Side_Frontend
docker build -t crime-tracer-server .
docker run -p 80:80 crime-tracer-server
```

## Kubernetes Deployment

Kubernetes manifests are not yet created. To deploy:

1. Create namespace:
   ```bash
   kubectl create namespace crime-tracer
   ```

2. Create ConfigMap and Secrets:
   ```bash
   kubectl create secret generic crime-tracer-secrets \
     --from-env-file=.env \
     -n crime-tracer
   ```

3. Deploy services (manifests to be created)

## Health Checks

All services expose health check endpoints:

- Backend: `GET /api/health`
- ML Service: `GET /health`
- Frontend: `GET /health`

## Monitoring

- Prometheus metrics: `GET /metrics` (Backend and ML Service)
- Logs: Structured JSON logs in production mode
- Health checks: Use `/api/health` for dependency status

## Scaling

### Horizontal Scaling

- Backend: Stateless, can scale horizontally
- ML Service: Can scale independently
- Frontend: Stateless, use load balancer

### Database Scaling

- Firebase Firestore: Auto-scales
- SQLite: Single instance only (use Firebase for production)

## Backup Strategy

### Database Backups

- Firebase: Use Firestore export
- SQLite: Copy database file regularly

### File Storage Backups

- S3: Enable versioning and lifecycle policies
- Local: Regular filesystem backups

## Security Checklist

- [ ] Change default SECRET_KEY
- [ ] Configure CORS origins
- [ ] Set up HTTPS/TLS
- [ ] Configure rate limiting
- [ ] Set up WAF (optional)
- [ ] Enable audit logging
- [ ] Configure firewall rules
- [ ] Set up monitoring alerts

## Troubleshooting

### Services won't start

- Check environment variables
- Verify database connectivity
- Check port availability
- Review container logs

### High memory usage

- Check ML service model loading
- Review background tasks
- Monitor metrics endpoint

### Database connection issues

- Verify connection string
- Check network connectivity
- Review database logs
