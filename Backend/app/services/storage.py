# app/services/storage.py
import base64
import hashlib
from pathlib import Path
from typing import Tuple, List
import boto3
from botocore.exceptions import BotoCoreError, ClientError
import logging

try:
    import magic
    MAGIC_AVAILABLE = True
except ImportError:
    MAGIC_AVAILABLE = False
    logging.warning("python-magic not available, using content-type validation only")

from ..config import settings
from ..models import StorageType

logger = logging.getLogger("crime_tracer.storage")

# Import metrics (with fallback if not available)
try:
    from ..utils.metrics import file_uploads_total, file_upload_size_bytes
    METRICS_AVAILABLE = True
except ImportError:
    METRICS_AVAILABLE = False
    logger.warning("Metrics not available")

LOCAL_UPLOAD_DIR = Path(settings.UPLOAD_DIR)
LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Allowed file types (MIME types)
ALLOWED_MIME_TYPES = {
    # Images
    "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
    # Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
    # Videos
    "video/mp4", "video/mpeg", "video/quicktime",
    # Audio
    "audio/mpeg", "audio/wav", "audio/mp4",
}

# Maximum file size: 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB in bytes

# File extension to MIME type mapping (for validation)
EXTENSION_TO_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".mp4": "video/mp4",
    ".mpeg": "video/mpeg",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
}


def validate_file_type(file_bytes: bytes, content_type: str, filename: str) -> Tuple[bool, str]:
    """
    Validate file type using magic bytes (file signature).
    Returns (is_valid, error_message)
    """
    # Check file size
    if len(file_bytes) > MAX_FILE_SIZE:
        return False, f"File size exceeds maximum allowed size of {MAX_FILE_SIZE / (1024*1024):.1f}MB"
    
    if len(file_bytes) == 0:
        return False, "File is empty"
    
    # Detect MIME type from magic bytes
    if MAGIC_AVAILABLE:
        try:
            mime = magic.Magic(mime=True)
            detected_mime = mime.from_buffer(file_bytes[:1024])  # Check first 1KB
        except Exception as e:
            logger.warning(f"Magic byte detection failed: {e}, falling back to content-type")
            detected_mime = content_type
    else:
        # Fallback to content-type if magic is not available
        detected_mime = content_type or "application/octet-stream"
    
    # Normalize MIME types
    detected_mime = detected_mime.lower().split(';')[0].strip()
    content_type = content_type.lower().split(';')[0].strip() if content_type else ""
    
    # Check if detected MIME type is allowed
    if detected_mime not in ALLOWED_MIME_TYPES:
        return False, f"File type '{detected_mime}' is not allowed. Allowed types: images, PDFs, documents, videos, audio"
    
    # Verify content-type matches detected type (if provided)
    if content_type and detected_mime != content_type:
        logger.warning(f"MIME type mismatch: declared={content_type}, detected={detected_mime}")
        # Use detected type as it's more reliable
    
    # Additional check: verify extension matches MIME type
    file_ext = Path(filename).suffix.lower()
    if file_ext in EXTENSION_TO_MIME:
        expected_mime = EXTENSION_TO_MIME[file_ext]
        if detected_mime != expected_mime:
            logger.warning(f"File extension mismatch: ext={file_ext}, detected={detected_mime}, expected={expected_mime}")
    
    return True, ""


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent directory traversal and other attacks.
    """
    # Remove path components
    filename = Path(filename).name
    
    # Remove dangerous characters
    dangerous_chars = ['/', '\\', '..', '<', '>', ':', '"', '|', '?', '*']
    for char in dangerous_chars:
        filename = filename.replace(char, '_')
    
    # Limit filename length
    if len(filename) > 255:
        name, ext = Path(filename).stem[:200], Path(filename).suffix
        filename = name + ext
    
    return filename

def _get_s3_client():
    if not settings.AWS_ACCESS_KEY_ID or not settings.S3_BUCKET_NAME:
        return None
    try:
        return boto3.client("s3", aws_access_key_id=settings.AWS_ACCESS_KEY_ID, aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY, region_name=settings.AWS_REGION)
    except Exception:
        return None

def store_base64_file(file_name: str, content_type: str, data_base64: str) -> Tuple[StorageType, str, str]:
    """
    Store a base64-encoded file with security validation.
    
    Args:
        file_name: Original filename (will be sanitized)
        content_type: MIME type of the file
        data_base64: Base64-encoded file content
    
    Returns:
        Tuple of (StorageType, storage_path_or_key, sha256_hash)
    
    Raises:
        ValueError: If file validation fails
    """
    # Decode base64
    if "," in data_base64:
        data_base64 = data_base64.split(",", 1)[1]
    
    try:
        file_bytes = base64.b64decode(data_base64)
    except Exception as e:
        raise ValueError(f"Invalid base64 encoding: {str(e)}")
    
    # Sanitize filename
    file_name = sanitize_filename(file_name)
    
    # Validate file type and size
    is_valid, error_msg = validate_file_type(file_bytes, content_type, file_name)
    if not is_valid:
        raise ValueError(error_msg)
    
    # Calculate hash
    sha256 = hashlib.sha256(file_bytes).hexdigest()
    # Track file upload metrics
    if METRICS_AVAILABLE:
        file_upload_size_bytes.observe(len(file_bytes))
    
    s3_client = _get_s3_client()
    if s3_client is not None:
        key = f"complaints/{sha256[:8]}_{file_name}"
        
        # Use circuit breaker and retry for S3 uploads
        from ..utils.circuit_breaker import s3_circuit_breaker
        from ..utils.retry import retry_with_backoff
        from ..utils.exceptions import ExternalServiceError
        
        @retry_with_backoff(max_attempts=3, initial_delay=1.0, exceptions=(BotoCoreError, ClientError, Exception))
        def _upload_to_s3():
            s3_client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=key,
                Body=file_bytes,
                ContentType=content_type
            )
        
        try:
            s3_circuit_breaker.call(_upload_to_s3)
            if METRICS_AVAILABLE:
                file_uploads_total.labels(storage_type="S3", status="success").inc()
            return StorageType.S3, key, sha256
        except ExternalServiceError:
            logger.warning("S3 service unavailable (circuit breaker open), falling back to local")
            if METRICS_AVAILABLE:
                file_uploads_total.labels(storage_type="S3", status="failed").inc()
        except (BotoCoreError, ClientError) as e:
            logger.warning(f"S3 upload failed: {e}, falling back to local")
            if METRICS_AVAILABLE:
                file_uploads_total.labels(storage_type="S3", status="failed").inc()
        except Exception as e:
            logger.error(f"Unexpected error during S3 upload: {e}")
            if METRICS_AVAILABLE:
                file_uploads_total.labels(storage_type="S3", status="error").inc()
    
    # Fallback to local storage
    LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = f"{sha256[:8]}_{file_name}"
    path = LOCAL_UPLOAD_DIR / safe_name
    try:
        with open(path, "wb") as f:
            f.write(file_bytes)
        if METRICS_AVAILABLE:
            file_uploads_total.labels(storage_type="LOCAL", status="success").inc()
        return StorageType.LOCAL, str(path), sha256
    except Exception as e:
        logger.error(f"Local file storage failed: {e}")
        if METRICS_AVAILABLE:
            file_uploads_total.labels(storage_type="LOCAL", status="error").inc()
        raise ValueError(f"File storage failed: {str(e)}")
