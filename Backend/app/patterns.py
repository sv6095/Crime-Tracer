# app/patterns.py
"""
Pattern Discovery API Router
Handles cross-case pattern detection and relationship discovery
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .db import get_db
from . import models, schemas
from .deps import get_cop, get_admin
from .services.pattern_matcher import get_pattern_matcher

router = APIRouter()


@router.get("/{case_id}/patterns", response_model=List[schemas.CasePatternOut])
def get_case_patterns(
    case_id: int,
    pattern_type: Optional[str] = None,
    min_confidence: Optional[float] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop),
):
    """Get related cases and patterns for a case."""
    # Verify case exists
    case = db.query(models.Complaint).filter(models.Complaint.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access
    if user.role != models.UserRole.ADMIN:
        if case.station_id != user.station_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this case")
    
    pattern_matcher = get_pattern_matcher(db)
    patterns = pattern_matcher.get_case_patterns(case_id)
    
    # Filter by pattern type if provided
    if pattern_type:
        patterns = [p for p in patterns if p.pattern_type == pattern_type]
    
    # Filter by minimum confidence if provided
    if min_confidence is not None:
        patterns = [p for p in patterns if float(p.confidence_score) >= min_confidence]
    
    # Get related case details
    related_case_ids = {p.related_case_id for p in patterns}
    related_cases = {
        c.id: c
        for c in db.query(models.Complaint)
        .filter(models.Complaint.id.in_(related_case_ids))
        .all()
    }
    
    return [
        schemas.CasePatternOut(
            id=p.id,
            case_id=p.case_id,
            related_case_id=p.related_case_id,
            related_case_complaint_id=related_cases.get(p.related_case_id).complaint_id if related_cases.get(p.related_case_id) else None,
            pattern_type=p.pattern_type,
            confidence_score=float(p.confidence_score),
            match_details=p.match_details,
            detected_at=p.detected_at,
            verified_by=p.verified_by,
            verified_at=p.verified_at,
        )
        for p in patterns
    ]


@router.post("/{case_id}/patterns/analyze", response_model=schemas.PatternAnalysisOut)
def analyze_patterns(
    case_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop),
):
    """Trigger pattern analysis for a case."""
    # Verify case exists
    case = db.query(models.Complaint).filter(models.Complaint.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access
    if user.role != models.UserRole.ADMIN:
        if case.station_id != user.station_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this case")
    
    pattern_matcher = get_pattern_matcher(db)
    patterns = pattern_matcher.analyze_case_patterns(case_id)
    
    return schemas.PatternAnalysisOut(
        case_id=case_id,
        patterns_found=len(patterns),
        patterns=patterns,
    )


@router.get("/patterns/suspect/{suspect_name}", response_model=List[schemas.CasePatternOut])
def find_cases_by_suspect(
    suspect_name: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop),
):
    """Find cases by suspect name (searches OCR-extracted entities)."""
    # This is a simplified implementation
    # In production, would search OCR text and entity extraction results
    
    # For now, return empty list - would need entity extraction table
    return []


@router.post("/patterns/{pattern_id}/verify", response_model=schemas.CasePatternOut)
def verify_pattern(
    pattern_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop),
):
    """Mark a pattern as verified by an investigator."""
    pattern_matcher = get_pattern_matcher(db)
    
    try:
        pattern = pattern_matcher.verify_pattern(pattern_id, user.id)
        
        related_case = db.query(models.Complaint).filter(models.Complaint.id == pattern.related_case_id).first()
        
        return schemas.CasePatternOut(
            id=pattern.id,
            case_id=pattern.case_id,
            related_case_id=pattern.related_case_id,
            related_case_complaint_id=related_case.complaint_id if related_case else None,
            pattern_type=pattern.pattern_type,
            confidence_score=float(pattern.confidence_score),
            match_details=pattern.match_details,
            detected_at=pattern.detected_at,
            verified_by=pattern.verified_by,
            verified_at=pattern.verified_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
