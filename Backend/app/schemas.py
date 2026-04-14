# app/schemas.py
from datetime import datetime
from typing import List, Optional, Any, Dict

from pydantic import BaseModel, EmailStr, Field


# ============================================================
# USER / AUTH SCHEMAS
# ============================================================

class UserBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    station_id: Optional[str] = None


class UserCreateVictim(UserBase):
    password: str = Field(min_length=6)
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class UserCreateCop(BaseModel):
    name: str
    username: str
    password: str
    station_id: str
    phone: Optional[str] = None
    badge_number: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    role: str
    station_id: Optional[str]
    station_name: Optional[str] = None
    badge_number: Optional[str] = None

    # expose verification flags to frontend
    email_verified: Optional[bool] = None
    phone_verified: Optional[bool] = None

    model_config = {"from_attributes": True}


# ============================================================
# VICTIM PROFILE SCHEMAS
# ============================================================

class VictimProfileOut(BaseModel):
    id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    station_id: Optional[str]
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]

    # expose verification flags
    email_verified: Optional[bool] = None
    phone_verified: Optional[bool] = None

    model_config = {"from_attributes": True}


class VictimProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    station_id: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


# ============================================================
# STATION SCHEMAS
# ============================================================

class StationOut(BaseModel):
    id: str
    name: str
    address: Optional[str] = None
    jurisdiction: Optional[str] = None

    model_config = {"from_attributes": True}


# ============================================================
# EVIDENCE & COMPLAINT CREATION
# ============================================================

class EvidenceUpload(BaseModel):
    file_name: str
    content_type: str
    data_base64: str


class EvidenceOut(BaseModel):
    id: int
    file_name: str
    content_type: str
    storage_type: str
    storage_path: str
    sha256: Optional[str]
    evidence_type: Optional[str] = None
    text_content: Optional[str] = None
    deleted_at: Optional[datetime] = None
    recording_duration: Optional[int] = None
    recording_format: Optional[str] = None
    uploaded_by_id: int
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class EvidenceCreate(BaseModel):
    evidence_type: str  # 'text', 'csv', 'pdf', 'image', 'video', 'audio', 'live_recording'
    text_content: Optional[str] = None  # For text/CSV evidence
    file_name: Optional[str] = None  # For file uploads
    content_type: Optional[str] = None  # MIME type
    recording_duration: Optional[int] = None
    recording_format: Optional[str] = None


class EvidenceUpdate(BaseModel):
    file_name: Optional[str] = None
    text_content: Optional[str] = None
    forensic_tags: Optional[List[str]] = None


class ComplaintCreate(BaseModel):
    crime_type: str
    description: str

    station_id: str

    location_text: Optional[str] = None
    location_lat: Optional[str] = None
    location_lng: Optional[str] = None
    location_accuracy: Optional[str] = None

    evidence: List[EvidenceUpload] = []
    upload_ids: Optional[List[int]] = None  # IDs from temporary_uploads table


class ComplaintSummary(BaseModel):
    complaint_id: str
    crime_type: Optional[str]
    description: Optional[str]
    status: str
    created_at: datetime
    station_name: Optional[str]

    model_config = {"from_attributes": True}


class ComplaintHistoryOut(BaseModel):
    status: str
    reason: Optional[str]
    created_at: datetime = Field(validation_alias="changed_at")
    updated_by: Optional[str] = None
    
    model_config = {"from_attributes": True}


class ComplaintTimelineOut(BaseModel):
    from_state: str
    to_state: str
    reason: Optional[str] = None
    created_at: datetime
    updated_by: Optional[str] = None  # Will be populated from actor
    
    model_config = {"from_attributes": True}


class ComplaintDetail(BaseModel):
    complaint_id: str
    crime_type: str
    description: str
    status: str
    created_at: datetime

    location_text: Optional[str]
    location_lat: Optional[str]
    location_lng: Optional[str]

    summary: Optional[str] = None
    precautions: Optional[List[str]] = None
    bns_sections: Optional[List[Dict[str, Any]]] = None
    predicted_severity: Optional[str] = None
    victim_confirmation_deadline: Optional[datetime] = None

    assigned_officer: Optional[str] = None

    evidence: List[EvidenceOut] = []
    notes: List[Dict[str, Any]] = []
    history: List[ComplaintHistoryOut] = []
    timeline: List[ComplaintTimelineOut] = []

    model_config = {"from_attributes": True}


class VictimConfirmResolution(BaseModel):
    complaint_id: str
    confirm: bool
    feedback: Optional[str] = None


# ============================================================
# CASES (COP WORKFLOW) — REQUIRED BY cases.py
# ============================================================

class CaseListItem(BaseModel):
    complaint_id: str
    status: str
    state: Optional[str] = None  # Added state
    crime_type: Optional[str] = None
    created_at: datetime
    station_id: Optional[str] = None # station_id is string/GUID in models

    model_config = {"from_attributes": True}


class NoteCreate(BaseModel):
    complaint_id: str
    content: str
    visible_to_victim: bool = False


class CaseNoteOut(BaseModel):
    id: int
    content: str
    created_at: datetime
    created_by: Optional[str]
    visible_to_victim: bool

    model_config = {"from_attributes": True}


class CaseDetailOut(BaseModel):
    id: Optional[int] = None  # Integer ID for investigation platform features
    complaint_id: str
    crime_type: str
    description: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    victim_name: Optional[str] = None
    victim_phone: Optional[str] = None
    station_name: Optional[str] = None

    assigned_cop_name: Optional[str] = None
    assigned_cop_station: Optional[str] = None
    assigned_police_id: Optional[int] = None  # ID of assigned officer

    location_text: Optional[str] = None
    location_lat: Optional[str] = None
    location_lng: Optional[str] = None

    evidence: List[EvidenceOut] = []
    notes: List[CaseNoteOut] = []
    history: List[ComplaintHistoryOut] = []

    llm_summary: Optional[str] = None
    officer_summary: Optional[str] = None  # Police case brief
    precautions: Optional[List[str]] = None
    bns_sections: Optional[List[Dict[str, Any]]] = None
    predicted_severity: Optional[str] = None
    victim_confirmation_deadline: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ============================================================
# CASE ACTION REQUESTS
# ============================================================

class AssignCaseRequest(BaseModel):
    complaint_id: str


class RejectCaseRequest(BaseModel):
    complaint_id: str
    reason: Optional[str] = None


class StatusUpdateRequest(BaseModel):
    complaint_id: str
    new_status: str
    reason: Optional[str] = None


# ============================================================
# ADMIN SCHEMAS
# ============================================================

class CopApprovalOut(BaseModel):
    id: int
    name: str
    username: str
    badge_number: Optional[str] = None
    station: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    is_admin: bool = False
    needs_admin_approval: bool = False
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CopApproveRequest(BaseModel):
    user_id: int
    approve: bool


class TransferRequestCreate(BaseModel):
    to_station_id: str


class TransferRequestUpdate(BaseModel):
    request_id: int
    approve: bool


# ============================================================
# OTP SCHEMAS
# ============================================================

class OtpSendRequest(BaseModel):
    channel: str = Field(pattern="^(phone|email)$")
    value: str


class OtpVerifyRequest(BaseModel):
    channel: str = Field(pattern="^(phone|email)$")
    value: str
    code: str


class OtpStatusOut(BaseModel):
    channel: str
    verified: bool


# ============================================================
# AUTH TOKEN / GENERIC STATUS
# ============================================================

class Token(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: Optional[int] = None  # seconds until expiration


class TokenRefresh(BaseModel):
    refresh_token: str


class StatusMessage(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None


# ============================================================
# INVESTIGATION PLATFORM SCHEMAS
# ============================================================

class DiaryEntryCreate(BaseModel):
    entry_type: str = Field(pattern="^(note|theory|observation|brainstorm)$")
    content: str
    encrypted: Optional[bool] = True


class DiaryEntryUpdate(BaseModel):
    content: Optional[str] = None
    entry_type: Optional[str] = Field(None, pattern="^(note|theory|observation|brainstorm)$")


class DiaryEntryOut(BaseModel):
    id: int
    case_id: int
    investigator_id: int
    investigator_name: str
    entry_type: str
    content: str
    encrypted: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EvidenceChangeOut(BaseModel):
    id: int
    change_id: str
    case_id: int
    user_id: int
    user_name: str
    section_modified: str
    field_changed: Optional[str]
    change_type: str
    old_value: Optional[str]
    new_value: Optional[str]
    details: Optional[str]
    cryptographic_hash: str
    timestamp: datetime
    ip_address: Optional[str]
    user_agent: Optional[str]

    model_config = {"from_attributes": True}


class IntegrityVerificationOut(BaseModel):
    case_id: int
    all_valid: bool
    results: Dict[str, bool]


class CasePatternOut(BaseModel):
    id: int
    case_id: int
    related_case_id: int
    related_case_complaint_id: Optional[str]
    pattern_type: str
    confidence_score: float
    match_details: Optional[Dict[str, Any]]
    detected_at: datetime
    verified_by: Optional[int]
    verified_at: Optional[datetime]

    model_config = {"from_attributes": True}


class PatternAnalysisOut(BaseModel):
    case_id: int
    patterns_found: int
    patterns: List[Dict[str, Any]]


class ForensicAnalysisOut(BaseModel):
    id: int
    evidence_id: int
    analysis_type: str
    analysis_result: Dict[str, Any]
    model_version: Optional[str]
    confidence_score: Optional[float]
    processing_time_ms: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}
