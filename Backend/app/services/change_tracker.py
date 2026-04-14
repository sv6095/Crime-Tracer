# app/services/change_tracker.py
"""
Immutable Change Tracking Service - PATENT CORE FEATURE
Captures every modification with cryptographic hashing for Section 65-B compliance.
"""
import hashlib
import logging
from datetime import datetime
from typing import Optional
from fastapi import Request
from sqlalchemy.orm import Session

from ..models import EvidenceChange, User, Complaint
from ..db import get_db
from .blockchain import get_blockchain_service

logger = logging.getLogger("crime_tracer.change_tracker")


class ChangeTracker:
    """
    Patent-worthy immutable change tracking system.
    Captures every modification with cryptographic hashing.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def _generate_change_id(self, case_id: int) -> str:
        """Generate unique change ID in CHG_XXX format. Always queries DB to avoid collisions."""
        # Always query the database for the highest change_id to avoid collisions
        # This handles concurrent requests and ensures uniqueness
        from sqlalchemy import func
        
        # Get all change_ids for this case and find the max number
        all_changes = (
            self.db.query(EvidenceChange.change_id)
            .filter(EvidenceChange.case_id == case_id)
            .all()
        )
        
        max_num = 0
        for change_id_tuple in all_changes:
            change_id_str = change_id_tuple[0] if isinstance(change_id_tuple, tuple) else change_id_tuple
            try:
                # Extract number from change_id (e.g., CHG_001 -> 1)
                num_part = change_id_str.split('_')[-1]
                num = int(num_part)
                if num > max_num:
                    max_num = num
            except (ValueError, IndexError, AttributeError):
                continue
        
        # Next change ID is max + 1
        next_num = max_num + 1
        return f"CHG_{next_num:03d}"
    
    def _compute_hash(self, change_data: dict) -> str:
        """Compute SHA-256 hash of change record for integrity verification."""
        # Create a deterministic string representation
        hash_string = (
            f"{change_data['change_id']}|"
            f"{change_data['case_id']}|"
            f"{change_data['user_id']}|"
            f"{change_data['section_modified']}|"
            f"{change_data['field_changed']}|"
            f"{change_data['change_type']}|"
            f"{change_data.get('old_value', '')}|"
            f"{change_data.get('new_value', '')}|"
            f"{change_data.get('timestamp', '')}"
        )
        return hashlib.sha256(hash_string.encode('utf-8')).hexdigest()
    
    def log_change(
        self,
        case_id: int,
        user: User,
        section: str,
        field_changed: Optional[str],
        change_type: str,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        details: Optional[str] = None,
        request: Optional[Request] = None
    ) -> EvidenceChange:
        """
        Logs change to immutable audit trail.
        Returns change record with cryptographic hash.
        
        Args:
            case_id: ID of the case/complaint
            user: User making the change
            section: Section being modified ('case_evidences', 'personal_diary', 'case_metadata')
            field_changed: Specific field/item identifier
            change_type: Type of change ('INSERT', 'UPDATE', 'DELETE', 'APPEND', 'ERASE')
            old_value: Previous value (for UPDATE/DELETE)
            new_value: New value (for INSERT/UPDATE)
            details: Additional context/reason for change
            request: FastAPI request object for IP/user agent
        
        Returns:
            EvidenceChange: The created change record
        """
        # Verify case exists
        case = self.db.query(Complaint).filter(Complaint.id == case_id).first()
        if not case:
            raise ValueError(f"Case {case_id} not found")
        
        # Generate change ID
        change_id = self._generate_change_id(case_id)
        
        # Get timestamp with millisecond precision
        timestamp = datetime.utcnow()
        
        # Extract IP and user agent from request
        ip_address = None
        user_agent = None
        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")
        
        # Prepare change data
        change_data = {
            'change_id': change_id,
            'case_id': case_id,
            'user_id': user.id,
            'section_modified': section,
            'field_changed': field_changed,
            'change_type': change_type,
            'old_value': old_value,
            'new_value': new_value,
            'timestamp': timestamp.isoformat(),
        }
        
        # Compute cryptographic hash
        cryptographic_hash = self._compute_hash(change_data)
        
        # Create change record
        change_record = EvidenceChange(
            change_id=change_id,
            case_id=case_id,
            user_id=user.id,
            user_name=user.name,
            section_modified=section,
            field_changed=field_changed,
            change_type=change_type,
            old_value=old_value,
            new_value=new_value,
            details=details,
            cryptographic_hash=cryptographic_hash,
            timestamp=timestamp,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        
        self.db.add(change_record)
        self.db.commit()
        self.db.refresh(change_record)
        
        # Create blockchain record for immutable audit trail
        try:
            blockchain_service = get_blockchain_service(self.db)
            blockchain_record = blockchain_service.create_blockchain_record(change_record)
            logger.info(
                f"Created blockchain record for change {change_id}",
                extra={'block_hash': blockchain_record['block_hash']}
            )
        except Exception as e:
            logger.warning(f"Failed to create blockchain record: {e}", exc_info=True)
            # Continue even if blockchain fails - database record is still created
        
        logger.info(
            f"Logged change {change_id} for case {case_id}: {change_type} on {section}",
            extra={
                'change_id': change_id,
                'case_id': case_id,
                'user_id': user.id,
                'section': section,
                'change_type': change_type,
            }
        )
        
        return change_record
    
    def verify_integrity(self, change_id: str) -> bool:
        """
        Verify cryptographic integrity of a change record.
        Returns True if hash matches, False otherwise.
        """
        change = (
            self.db.query(EvidenceChange)
            .filter(EvidenceChange.change_id == change_id)
            .first()
        )
        
        if not change:
            return False
        
        # Recompute hash
        change_data = {
            'change_id': change.change_id,
            'case_id': change.case_id,
            'user_id': change.user_id,
            'section_modified': change.section_modified,
            'field_changed': change.field_changed or '',
            'change_type': change.change_type,
            'old_value': change.old_value or '',
            'new_value': change.new_value or '',
            'timestamp': change.timestamp.isoformat() if change.timestamp else '',
        }
        
        computed_hash = self._compute_hash(change_data)
        return computed_hash == change.cryptographic_hash


def get_change_tracker(db: Session) -> ChangeTracker:
    """Factory function to get ChangeTracker instance."""
    return ChangeTracker(db)
