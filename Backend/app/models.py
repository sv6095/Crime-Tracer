# app/models.py
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Text,
    JSON,
    Index,
    Numeric,
)
from sqlalchemy.orm import relationship, declarative_base

# 🔒 Phase-1 authoritative constants
from .constants import ComplaintState, Role, MLStatus

Base = declarative_base()

# ============================================================
# LEGACY ENUMS (KEPT FOR BACKWARD COMPATIBILITY)
# ============================================================

class UserRole(str, Enum):
    VICTIM = "VICTIM"
    COP = "COP"
    ADMIN = "ADMIN"


class ComplaintStatus(str, Enum):
    """
    LEGACY — DO NOT REMOVE.
    Used by existing routers.
    """
    NOT_ASSIGNED = "NOT_ASSIGNED"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"
    REJECTED = "REJECTED"


class StorageType(str, Enum):
    LOCAL = "LOCAL"
    S3 = "S3"


# ============================================================
# USER
# ============================================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(200), nullable=False)
    email = Column(String(255), unique=True, nullable=True, index=True)
    phone = Column(String(20), unique=True, nullable=True, index=True)
    username = Column(String(100), unique=True, nullable=True, index=True)

    password_hash = Column(String(255), nullable=False)

    # 🔁 keep legacy role enum
    role = Column(SAEnum(UserRole), nullable=False)

    address = Column(String(500), nullable=True)
    station_id = Column(String(64), ForeignKey("stations.id"), nullable=True)
    emergency_contact_name = Column(String(200), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)

    email_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)

    badge_number = Column(String(100), nullable=True)
    pending_approval = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Account lockout fields
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    last_failed_login = Column(DateTime, nullable=True)
    
    # 2FA fields (for future implementation)
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    station = relationship("Station", back_populates="users")
    complaints = relationship(
        "Complaint",
        back_populates="victim",
        cascade="all, delete-orphan",
    )

# ============================================================
# STATION
# ============================================================

class Station(Base):
    __tablename__ = "stations"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    jurisdiction = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="station")
    complaints = relationship("Complaint", back_populates="station")

# ============================================================
# COMPLAINT
# ============================================================

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(String(64), unique=True, index=True)

    victim_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    station_id = Column(String(64), ForeignKey("stations.id"), nullable=False)

    crime_type = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)

    location_text = Column(String(500), nullable=True)
    location_lat = Column(String(64), nullable=True)
    location_lng = Column(String(64), nullable=True)
    location_accuracy = Column(String(64), nullable=True)

    # 🔁 legacy status (DO NOT REMOVE)
    status = Column(
        SAEnum(ComplaintStatus),
        default=ComplaintStatus.NOT_ASSIGNED,
        index=True,
    )

    # 🆕 authoritative state machine status
    state = Column(
        SAEnum(ComplaintState),
        default=ComplaintState.FILED,
        index=True,
        nullable=False,
    )

    # timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    archived_at = Column(DateTime, nullable=True)

    # =========================
    # AI / ML (PHASE-2)
    # =========================

    summary = Column(Text, nullable=True)  # Victim-facing summary
    officer_summary = Column(Text, nullable=True)  # Police officer case brief
    bns_sections = Column(JSON, nullable=True)
    precautions = Column(JSON, nullable=True)

    ml_confidence = Column(Integer, nullable=True)  # 0–100
    low_confidence_flag = Column(Boolean, default=False)
    ml_status = Column(SAEnum(MLStatus), default=MLStatus.OK)

    ml_model_version = Column(String(100), nullable=True)
    ml_generated_at = Column(DateTime, nullable=True)
    predicted_severity = Column(String(50), nullable=True)

    victim_confirmation_deadline = Column(DateTime, nullable=True)

    victim = relationship("User", back_populates="complaints")
    station = relationship("Station", back_populates="complaints")

    evidence = relationship(
        "Evidence",
        back_populates="complaint",
        cascade="all, delete-orphan",
    )
    history = relationship(
        "ComplaintStatusHistory",
        back_populates="complaint",
        cascade="all, delete-orphan",
        order_by="ComplaintStatusHistory.changed_at",
    )
    notes = relationship(
        "Note",
        back_populates="complaint",
        cascade="all, delete-orphan",
    )
    case = relationship("Case", back_populates="complaint", uselist=False)

    # 🆕 immutable timeline
    timeline = relationship(
        "ComplaintTimeline",
        back_populates="complaint",
        cascade="all, delete-orphan",
        order_by="ComplaintTimeline.created_at",
    )

    # Investigation platform relationships
    diary_entries = relationship(
        "InvestigationDiary",
        foreign_keys="InvestigationDiary.case_id",
        cascade="all, delete-orphan",
        order_by="InvestigationDiary.created_at",
    )
    evidence_changes = relationship(
        "EvidenceChange",
        foreign_keys="EvidenceChange.case_id",
        cascade="all, delete-orphan",
        order_by="EvidenceChange.timestamp",
    )
    case_patterns = relationship(
        "CasePattern",
        foreign_keys="CasePattern.case_id",
        cascade="all, delete-orphan",
    )
    related_patterns = relationship(
        "CasePattern",
        foreign_keys="CasePattern.related_case_id",
    )

    @property
    def assigned_officer(self):
        if self.case and self.case.assigned_officer:
            return self.case.assigned_officer.name
        return None

# ============================================================
# CASE
# ============================================================

class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), unique=True)

    assigned_officer_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    rejection_count = Column(Integer, default=0)

    # 🔁 legacy
    last_status = Column(SAEnum(ComplaintStatus), nullable=True)

    # 🆕 authoritative
    last_state = Column(SAEnum(ComplaintState), nullable=False)

    last_update = Column(DateTime, default=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="case")
    assigned_officer = relationship("User")

# ============================================================
# IMMUTABLE TIMELINE (PHASE-2)
# ============================================================

class ComplaintTimeline(Base):
    __tablename__ = "complaint_timeline"

    id = Column(Integer, primary_key=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False)

    from_state = Column(SAEnum(ComplaintState), nullable=True)
    to_state = Column(SAEnum(ComplaintState), nullable=False)

    actor_role = Column(String(20), nullable=False)
    actor_id = Column(Integer, nullable=True)

    reason = Column(Text, nullable=True)
    meta = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="timeline")

# ============================================================
# REMAINING TABLES (UNCHANGED)
# ============================================================

class TemporaryUpload(Base):
    __tablename__ = "temporary_uploads"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)

    storage_type = Column(SAEnum(StorageType), nullable=False)
    storage_path = Column(String(1000), nullable=False)
    sha256 = Column(String(64), nullable=False, index=True)

    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)

    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=True)

    uploader = relationship("User")


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False)

    file_name = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)

    storage_type = Column(SAEnum(StorageType), nullable=False)
    storage_path = Column(String(1000), nullable=False)
    sha256 = Column(String(64), nullable=False, index=True)

    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    # Enhanced fields for investigation platform
    chain_of_custody = Column(JSON, nullable=True)
    forensic_tags = Column(JSON, nullable=True)  # Array stored as JSON
    yolo_detections = Column(JSON, nullable=True)
    ocr_text = Column(Text, nullable=True)
    voice_analysis = Column(JSON, nullable=True)
    
    # New evidence upload fields
    evidence_type = Column(String(50), nullable=True)  # 'text', 'csv', 'pdf', 'image', 'video', 'audio', 'live_recording'
    text_content = Column(Text, nullable=True)  # For text/CSV evidence stored directly
    deleted_at = Column(DateTime, nullable=True)  # Soft delete
    recording_duration = Column(Integer, nullable=True)  # Duration in seconds for audio/video
    recording_format = Column(String(50), nullable=True)  # 'mp3', 'wav', 'mp4', 'webm', etc.

    complaint = relationship("Complaint", back_populates="evidence")
    uploader = relationship("User")
    forensic_analyses = relationship("ForensicAnalysis", back_populates="evidence", cascade="all, delete-orphan")


class ComplaintStatusHistory(Base):
    __tablename__ = "complaint_status_history"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False)
    status = Column(SAEnum(ComplaintStatus), nullable=False)

    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow)
    reason = Column(Text, nullable=True)

    complaint = relationship("Complaint", back_populates="history")
    changed_by = relationship("User")

    @property
    def updated_by(self):
        return self.changed_by.name if self.changed_by else "System"


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    content = Column(Text, nullable=False)
    visible_to_victim = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="notes")
    author = relationship("User")


class CopTransferRequest(Base):
    __tablename__ = "cop_transfer_requests"

    id = Column(Integer, primary_key=True, index=True)
    cop_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    from_station_id = Column(String(64), ForeignKey("stations.id"), nullable=False)
    to_station_id = Column(String(64), ForeignKey("stations.id"), nullable=False)

    status = Column(String(20), default="pending")

    created_at = Column(DateTime, default=datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)

    cop = relationship("User")
    from_station = relationship("Station", foreign_keys=[from_station_id])
    to_station = relationship("Station", foreign_keys=[to_station_id])


class OtpChannel(str, Enum):
    PHONE = "phone"
    EMAIL = "email"


class OtpCode(Base):
    __tablename__ = "otp_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    channel = Column(SAEnum(OtpChannel), nullable=False)
    target_value = Column(String(255), nullable=False)
    code = Column(String(20), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    meta = Column(JSON, nullable=True)

    user = relationship("User")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(512), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked = Column(Boolean, default=False)
    revoked_at = Column(DateTime, nullable=True)
    
    # Metadata
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)

    user = relationship("User")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100), nullable=True)
    entity_id = Column(Integer, nullable=True)
    meta = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


# ============================================================
# INVESTIGATION PLATFORM MODELS
# ============================================================

class InvestigationDiary(Base):
    """Personal Diary for investigators - confidential notes separate from official evidence."""
    __tablename__ = "investigation_diary"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False, index=True)
    investigator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    entry_type = Column(String(50), nullable=False)  # 'note', 'theory', 'observation', 'brainstorm'
    content = Column(Text, nullable=False)
    encrypted = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    case = relationship("Complaint", overlaps="diary_entries")
    investigator = relationship("User")


class EvidenceChange(Base):
    """
    Immutable Audit Trail - PATENT CORE FEATURE
    Tracks every modification to case evidence and diary with cryptographic hashing.
    Once logged, records cannot be modified or deleted.
    """
    __tablename__ = "evidence_changes"

    id = Column(Integer, primary_key=True, index=True)
    change_id = Column(String(64), unique=True, nullable=False, index=True)  # CHG_001 format
    case_id = Column(Integer, ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    user_name = Column(String(255), nullable=False)
    
    section_modified = Column(String(50), nullable=False)  # 'case_evidences', 'personal_diary', 'case_metadata'
    field_changed = Column(String(255), nullable=True)  # Specific field/item identifier
    change_type = Column(String(20), nullable=False)  # 'INSERT', 'UPDATE', 'DELETE', 'APPEND', 'ERASE'
    
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    details = Column(Text, nullable=True)  # Reason/context for change
    
    cryptographic_hash = Column(String(64), nullable=False, index=True)  # SHA-256 of change record
    timestamp = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)  # Millisecond precision
    
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)

    case = relationship("Complaint", overlaps="evidence_changes")
    user = relationship("User")

    __table_args__ = (
        Index('idx_evidence_changes_case_timestamp', 'case_id', 'timestamp'),
        Index('idx_evidence_changes_user_timestamp', 'user_id', 'timestamp'),
    )


class CasePattern(Base):
    """Pattern Discovery - links related cases with confidence scores."""
    __tablename__ = "case_patterns"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False, index=True)
    related_case_id = Column(Integer, ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False, index=True)
    
    pattern_type = Column(String(50), nullable=False)  # 'suspect_match', 'voice_match', 'object_match', 'location_cluster', 'temporal_pattern'
    confidence_score = Column(Numeric(5, 2), nullable=False)  # 0.00 to 100.00
    match_details = Column(JSON, nullable=True)  # Specific matching criteria
    
    detected_at = Column(DateTime, default=datetime.utcnow, index=True)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)

    case = relationship("Complaint", foreign_keys=[case_id], overlaps="case_patterns")
    related_case = relationship("Complaint", foreign_keys=[related_case_id], overlaps="related_patterns")
    verifier = relationship("User", foreign_keys=[verified_by])


class ForensicAnalysis(Base):
    """ML Analysis Results - stores YOLO, voice analysis, OCR results."""
    __tablename__ = "forensic_analysis"

    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False, index=True)
    
    analysis_type = Column(String(50), nullable=False)  # 'yolo_object_detection', 'voice_analysis', 'ocr_extraction', 'fir_processing'
    analysis_result = Column(JSON, nullable=False)
    model_version = Column(String(100), nullable=True)
    confidence_score = Column(Numeric(5, 2), nullable=True)
    processing_time_ms = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    evidence = relationship("Evidence", back_populates="forensic_analyses")
