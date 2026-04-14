# app/forensics.py
"""
Forensic Analysis API Router
Handles ML-powered evidence analysis (YOLO, voice, OCR)
"""
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .db import get_db
from . import models, schemas
from .deps import get_cop, get_admin
from .services.forensic_analysis import get_forensic_service

router = APIRouter()


@router.post("/yolo/{evidence_id}", response_model=schemas.ForensicAnalysisOut)
def run_yolo_detection(
    evidence_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop),
):
    """Run YOLO object detection on image evidence."""
    # Verify evidence exists and user has access
    evidence = db.query(models.Evidence).filter(models.Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    case = db.query(models.Complaint).filter(models.Complaint.id == evidence.complaint_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access
    if user.role != models.UserRole.ADMIN:
        if case.station_id != user.station_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this evidence")
    
    forensic_service = get_forensic_service(db)
    
    try:
        result = forensic_service.run_yolo_detection(evidence_id)
        
        # Get the analysis record
        analysis = (
            db.query(models.ForensicAnalysis)
            .filter(
                models.ForensicAnalysis.evidence_id == evidence_id,
                models.ForensicAnalysis.analysis_type == 'yolo_object_detection',
            )
            .order_by(models.ForensicAnalysis.created_at.desc())
            .first()
        )
        
        if analysis:
            return schemas.ForensicAnalysisOut(
                id=analysis.id,
                evidence_id=analysis.evidence_id,
                analysis_type=analysis.analysis_type,
                analysis_result=analysis.analysis_result,
                model_version=analysis.model_version,
                confidence_score=float(analysis.confidence_score) if analysis.confidence_score else None,
                processing_time_ms=analysis.processing_time_ms,
                created_at=analysis.created_at,
            )
        else:
            raise HTTPException(status_code=500, detail="Analysis record not found")
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/voice/{evidence_id}", response_model=schemas.ForensicAnalysisOut)
def run_voice_analysis(
    evidence_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop),
):
    """Run voice analysis on audio evidence."""
    # Verify evidence exists and user has access
    evidence = db.query(models.Evidence).filter(models.Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    case = db.query(models.Complaint).filter(models.Complaint.id == evidence.complaint_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access
    if user.role != models.UserRole.ADMIN:
        if case.station_id != user.station_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this evidence")
    
    forensic_service = get_forensic_service(db)
    
    try:
        result = forensic_service.run_voice_analysis(evidence_id)
        
        # Get the analysis record
        analysis = (
            db.query(models.ForensicAnalysis)
            .filter(
                models.ForensicAnalysis.evidence_id == evidence_id,
                models.ForensicAnalysis.analysis_type == 'voice_analysis',
            )
            .order_by(models.ForensicAnalysis.created_at.desc())
            .first()
        )
        
        if analysis:
            return schemas.ForensicAnalysisOut(
                id=analysis.id,
                evidence_id=analysis.evidence_id,
                analysis_type=analysis.analysis_type,
                analysis_result=analysis.analysis_result,
                model_version=analysis.model_version,
                confidence_score=float(analysis.confidence_score) if analysis.confidence_score else None,
                processing_time_ms=analysis.processing_time_ms,
                created_at=analysis.created_at,
            )
        else:
            raise HTTPException(status_code=500, detail="Analysis record not found")
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/ocr/{evidence_id}", response_model=schemas.ForensicAnalysisOut)
def run_ocr_extraction(
    evidence_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop),
):
    """Run OCR extraction on document evidence. Limited to 10 times per case."""
    # Verify evidence exists and user has access
    evidence = db.query(models.Evidence).filter(models.Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    case = db.query(models.Complaint).filter(models.Complaint.id == evidence.complaint_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access
    if user.role != models.UserRole.ADMIN:
        if case.station_id != user.station_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this evidence")
    
    forensic_service = get_forensic_service(db)
    
    try:
        result = forensic_service.run_ocr_extraction(evidence_id)
        
        # Get the analysis record
        analysis = (
            db.query(models.ForensicAnalysis)
            .filter(
                models.ForensicAnalysis.evidence_id == evidence_id,
                models.ForensicAnalysis.analysis_type == 'ocr_extraction',
            )
            .order_by(models.ForensicAnalysis.created_at.desc())
            .first()
        )
        
        if analysis:
            return schemas.ForensicAnalysisOut(
                id=analysis.id,
                evidence_id=analysis.evidence_id,
                analysis_type=analysis.analysis_type,
                analysis_result={
                    **analysis.analysis_result,
                    'ocr_count': result.get('ocr_count', 0),
                    'remaining': result.get('remaining', 0),
                },
                model_version=analysis.model_version,
                confidence_score=float(analysis.confidence_score) if analysis.confidence_score else None,
                processing_time_ms=analysis.processing_time_ms,
                created_at=analysis.created_at,
            )
        else:
            raise HTTPException(status_code=500, detail="Analysis record not found")
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/fir/process", response_model=Dict[str, Any])
def process_fir_document(
    evidence_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop),
):
    """Process FIR document with OCR + relationship extraction."""
    # Verify evidence exists and user has access
    evidence = db.query(models.Evidence).filter(models.Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    case = db.query(models.Complaint).filter(models.Complaint.id == evidence.complaint_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access
    if user.role != models.UserRole.ADMIN:
        if case.station_id != user.station_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this evidence")
    
    forensic_service = get_forensic_service(db)
    
    try:
        result = forensic_service.process_fir_document(evidence_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FIR processing failed: {str(e)}")


@router.get("/{evidence_id}/analyses", response_model=List[schemas.ForensicAnalysisOut])
def get_evidence_analyses(
    evidence_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop),
):
    """Get all forensic analyses for an evidence item."""
    # Verify evidence exists and user has access
    evidence = db.query(models.Evidence).filter(models.Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    case = db.query(models.Complaint).filter(models.Complaint.id == evidence.complaint_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access
    if user.role != models.UserRole.ADMIN:
        if case.station_id != user.station_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this evidence")
    
    analyses = (
        db.query(models.ForensicAnalysis)
        .filter(models.ForensicAnalysis.evidence_id == evidence_id)
        .order_by(models.ForensicAnalysis.created_at.desc())
        .all()
    )
    
    # Get OCR count for this case
    ocr_count = (
        db.query(models.ForensicAnalysis)
        .join(models.Evidence, models.ForensicAnalysis.evidence_id == models.Evidence.id)
        .filter(
            models.Evidence.complaint_id == case.id,
            models.ForensicAnalysis.analysis_type == 'ocr_extraction'
        )
        .count()
    )
    
    return [
        schemas.ForensicAnalysisOut(
            id=a.id,
            evidence_id=a.evidence_id,
            analysis_type=a.analysis_type,
            analysis_result=a.analysis_result,
            model_version=a.model_version,
            confidence_score=float(a.confidence_score) if a.confidence_score else None,
            processing_time_ms=a.processing_time_ms,
            created_at=a.created_at,
        )
        for a in analyses
    ]


@router.get("/case/{case_id}/ocr-count")
def get_ocr_count(
    case_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_cop),
):
    """Get OCR extraction count for a case (max 10)."""
    case = db.query(models.Complaint).filter(models.Complaint.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access
    if user.role != models.UserRole.ADMIN:
        if case.station_id != user.station_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    ocr_count = (
        db.query(models.ForensicAnalysis)
        .join(models.Evidence, models.ForensicAnalysis.evidence_id == models.Evidence.id)
        .filter(
            models.Evidence.complaint_id == case_id,
            models.ForensicAnalysis.analysis_type == 'ocr_extraction'
        )
        .count()
    )
    
    return {
        'case_id': case_id,
        'ocr_count': ocr_count,
        'max_allowed': 10,
        'remaining': max(0, 10 - ocr_count),
        'limit_reached': ocr_count >= 10,
    }
