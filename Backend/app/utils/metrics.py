# app/utils/metrics.py
"""
Prometheus metrics for Crime Tracer Backend.

Tracks:
- HTTP request counts and latencies
- Authentication events
- File uploads
- Database operations
- External service calls
"""

from prometheus_client import Counter, Histogram, Gauge
from typing import Optional
import time

# HTTP Request Metrics
http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status_code"]
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
)

# Authentication Metrics
auth_attempts_total = Counter(
    "auth_attempts_total",
    "Total authentication attempts",
    ["result", "role"]  # result: success, failed, blocked
)

auth_tokens_issued_total = Counter(
    "auth_tokens_issued_total",
    "Total JWT tokens issued",
    ["role"]
)

# File Upload Metrics
file_uploads_total = Counter(
    "file_uploads_total",
    "Total file uploads",
    ["storage_type", "status"]  # storage_type: S3, LOCAL
)

file_upload_size_bytes = Histogram(
    "file_upload_size_bytes",
    "File upload size in bytes",
    buckets=(1024, 10240, 102400, 1048576, 10485760)  # 1KB, 10KB, 100KB, 1MB, 10MB
)

# Database Metrics
db_queries_total = Counter(
    "db_queries_total",
    "Total database queries",
    ["operation", "table"]  # operation: select, insert, update, delete
)

db_query_duration_seconds = Histogram(
    "db_query_duration_seconds",
    "Database query duration in seconds",
    ["operation"]
)

# External Service Metrics
external_service_requests_total = Counter(
    "external_service_requests_total",
    "Total external service requests",
    ["service", "status"]  # service: grok, ml_service, s3
)

external_service_duration_seconds = Histogram(
    "external_service_duration_seconds",
    "External service request duration in seconds",
    ["service"]
)

# Complaint Metrics
complaints_total = Counter(
    "complaints_total",
    "Total complaints created",
    ["status", "crime_type"]
)

complaint_status_changes_total = Counter(
    "complaint_status_changes_total",
    "Total complaint status changes",
    ["from_status", "to_status"]
)

# System Metrics
active_users = Gauge(
    "active_users",
    "Number of active users",
    ["role"]
)

active_complaints = Gauge(
    "active_complaints",
    "Number of active complaints",
    ["status"]
)


# Metrics middleware is implemented in main.py as MetricsMiddlewareWrapper
# This file contains metric definitions only
