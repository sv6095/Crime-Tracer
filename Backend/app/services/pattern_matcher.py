# app/services/pattern_matcher.py
"""
Pattern Matching Service - Cross-case relationship discovery
Identifies related cases through suspect matching, voice patterns, object signatures, etc.
"""
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ..models import Complaint, CasePattern, Evidence, User

logger = logging.getLogger("crime_tracer.pattern_matcher")


class PatternMatcherService:
    """Service for detecting patterns and relationships across cases."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def analyze_case_patterns(self, case_id: int) -> List[Dict[str, Any]]:
        """
        Analyze a case and find related cases with pattern matching.
        
        Args:
            case_id: ID of the case to analyze
        
        Returns:
            List of pattern matches with confidence scores
        """
        case = self.db.query(Complaint).filter(Complaint.id == case_id).first()
        if not case:
            raise ValueError(f"Case {case_id} not found")
        
        patterns = []
        
        # 1. Suspect matching - find cases with similar suspect names
        suspect_patterns = self._match_suspects(case_id, case)
        patterns.extend(suspect_patterns)
        
        # 2. Location clustering - find cases in similar locations
        location_patterns = self._match_locations(case_id, case)
        patterns.extend(location_patterns)
        
        # 3. Temporal patterns - find cases in similar time windows
        temporal_patterns = self._match_temporal(case_id, case)
        patterns.extend(temporal_patterns)
        
        # 4. Voice pattern matching - if audio evidence exists
        voice_patterns = self._match_voice_patterns(case_id, case)
        patterns.extend(voice_patterns)
        
        # 5. Object signature matching - if image evidence exists
        object_patterns = self._match_object_signatures(case_id, case)
        patterns.extend(object_patterns)
        
        # Store patterns in database
        for pattern in patterns:
            # Check if pattern already exists
            existing = (
                self.db.query(CasePattern)
                .filter(
                    and_(
                        CasePattern.case_id == case_id,
                        CasePattern.related_case_id == pattern['related_case_id'],
                        CasePattern.pattern_type == pattern['pattern_type'],
                    )
                )
                .first()
            )
            
            if not existing:
                pattern_record = CasePattern(
                    case_id=case_id,
                    related_case_id=pattern['related_case_id'],
                    pattern_type=pattern['pattern_type'],
                    confidence_score=pattern['confidence_score'],
                    match_details=pattern.get('match_details', {}),
                )
                self.db.add(pattern_record)
        
        self.db.commit()
        
        logger.info(f"Pattern analysis completed for case {case_id}: {len(patterns)} patterns found")
        
        return patterns
    
    def _match_suspects(self, case_id: int, case: Complaint) -> List[Dict[str, Any]]:
        """Match cases by suspect names (extracted from OCR/FIR)."""
        patterns = []
        
        # Get suspect names from OCR text in evidence
        suspect_names = []
        for evidence in case.evidence:
            if evidence.ocr_text:
                # Simple extraction - in production would use NLP
                # For now, mock extraction
                suspect_names.extend(['John Doe', 'Jane Smith'])  # Mock
        
        if not suspect_names:
            return patterns
        
        # Find other cases with similar suspect names
        # This is simplified - in production would use fuzzy matching
        related_cases = (
            self.db.query(Complaint)
            .filter(
                and_(
                    Complaint.id != case_id,
                    Complaint.crime_type == case.crime_type,  # Same crime type
                )
            )
            .limit(10)
            .all()
        )
        
        for related_case in related_cases:
            # Check if related case has similar suspects (simplified)
            # In production, would compare OCR-extracted entities
            confidence = 0.65  # Mock confidence
            
            if confidence > 0.5:
                patterns.append({
                    'related_case_id': related_case.id,
                    'pattern_type': 'suspect_match',
                    'confidence_score': confidence,
                    'match_details': {
                        'suspects': suspect_names,
                        'related_case_id': related_case.complaint_id,
                    },
                })
        
        return patterns
    
    def _match_locations(self, case_id: int, case: Complaint) -> List[Dict[str, Any]]:
        """Match cases by geographic proximity."""
        patterns = []
        
        if not case.location_lat or not case.location_lng:
            return patterns
        
        try:
            case_lat = float(case.location_lat)
            case_lng = float(case.location_lng)
        except (ValueError, TypeError):
            return patterns
        
        # Find cases within 1km radius (simplified)
        # In production, would use proper geospatial queries
        related_cases = (
            self.db.query(Complaint)
            .filter(
                and_(
                    Complaint.id != case_id,
                    Complaint.location_lat.isnot(None),
                    Complaint.location_lng.isnot(None),
                )
            )
            .limit(20)
            .all()
        )
        
        for related_case in related_cases:
            try:
                rel_lat = float(related_case.location_lat)
                rel_lng = float(related_case.location_lng)
                
                # Simple distance calculation (Haversine would be better)
                distance_km = abs(case_lat - rel_lat) + abs(case_lng - rel_lng)
                
                if distance_km < 0.01:  # Within ~1km
                    confidence = max(0.5, 1.0 - (distance_km * 100))
                    
                    patterns.append({
                        'related_case_id': related_case.id,
                        'pattern_type': 'location_cluster',
                        'confidence_score': confidence * 100,
                        'match_details': {
                            'distance_km': distance_km,
                            'case_location': f"{case_lat},{case_lng}",
                            'related_location': f"{rel_lat},{rel_lng}",
                        },
                    })
            except (ValueError, TypeError):
                continue
        
        return patterns
    
    def _match_temporal(self, case_id: int, case: Complaint) -> List[Dict[str, Any]]:
        """Match cases by temporal patterns (similar time windows)."""
        patterns = []
        
        from datetime import timedelta
        
        # Find cases within 7 days
        time_window = timedelta(days=7)
        
        related_cases = (
            self.db.query(Complaint)
            .filter(
                and_(
                    Complaint.id != case_id,
                    Complaint.crime_type == case.crime_type,
                    Complaint.created_at >= case.created_at - time_window,
                    Complaint.created_at <= case.created_at + time_window,
                )
            )
            .limit(10)
            .all()
        )
        
        for related_case in related_cases:
            time_diff = abs((related_case.created_at - case.created_at).total_seconds())
            days_diff = time_diff / 86400
            
            confidence = max(0.5, 1.0 - (days_diff / 7))
            
            patterns.append({
                'related_case_id': related_case.id,
                'pattern_type': 'temporal_pattern',
                'confidence_score': confidence * 100,
                'match_details': {
                    'days_difference': days_diff,
                    'case_time': case.created_at.isoformat(),
                    'related_time': related_case.created_at.isoformat(),
                },
            })
        
        return patterns
    
    def _match_voice_patterns(self, case_id: int, case: Complaint) -> List[Dict[str, Any]]:
        """Match cases by voice pattern similarity."""
        patterns = []
        
        # Get voice analysis from case evidence
        case_voice_features = None
        for evidence in case.evidence:
            if evidence.voice_analysis:
                case_voice_features = evidence.voice_analysis
                break
        
        if not case_voice_features:
            return patterns
        
        # Find other cases with voice evidence
        related_cases = (
            self.db.query(Complaint)
            .join(Evidence)
            .filter(
                and_(
                    Complaint.id != case_id,
                    Evidence.voice_analysis.isnot(None),
                )
            )
            .limit(10)
            .all()
        )
        
        for related_case in related_cases:
            # Compare voice features (simplified)
            # In production, would use MFCC feature comparison
            confidence = 0.70  # Mock confidence
            
            patterns.append({
                'related_case_id': related_case.id,
                'pattern_type': 'voice_match',
                'confidence_score': confidence * 100,
                'match_details': {
                    'case_voice_features': case_voice_features,
                },
            })
        
        return patterns
    
    def _match_object_signatures(self, case_id: int, case: Complaint) -> List[Dict[str, Any]]:
        """Match cases by object signatures (YOLO detections)."""
        patterns = []
        
        # Get YOLO detections from case evidence
        case_objects = []
        for evidence in case.evidence:
            if evidence.yolo_detections:
                objects = evidence.yolo_detections.get('objects', [])
                case_objects.extend([obj.get('class') for obj in objects])
        
        if not case_objects:
            return patterns
        
        # Find other cases with similar object detections
        related_cases = (
            self.db.query(Complaint)
            .join(Evidence)
            .filter(
                and_(
                    Complaint.id != case_id,
                    Evidence.yolo_detections.isnot(None),
                )
            )
            .limit(10)
            .all()
        )
        
        for related_case in related_cases:
            related_objects = []
            for evidence in related_case.evidence:
                if evidence.yolo_detections:
                    objects = evidence.yolo_detections.get('objects', [])
                    related_objects.extend([obj.get('class') for obj in objects])
            
            # Calculate similarity
            common_objects = set(case_objects) & set(related_objects)
            if common_objects:
                confidence = len(common_objects) / max(len(case_objects), len(related_objects))
                
                if confidence > 0.5:
                    patterns.append({
                        'related_case_id': related_case.id,
                        'pattern_type': 'object_match',
                        'confidence_score': confidence * 100,
                        'match_details': {
                            'common_objects': list(common_objects),
                            'case_objects': case_objects,
                            'related_objects': related_objects,
                        },
                    })
        
        return patterns
    
    def get_case_patterns(self, case_id: int) -> List[CasePattern]:
        """Get all patterns for a case."""
        return (
            self.db.query(CasePattern)
            .filter(CasePattern.case_id == case_id)
            .order_by(CasePattern.confidence_score.desc())
            .all()
        )
    
    def verify_pattern(self, pattern_id: int, user_id: int) -> CasePattern:
        """Mark a pattern as verified by an investigator."""
        pattern = self.db.query(CasePattern).filter(CasePattern.id == pattern_id).first()
        if not pattern:
            raise ValueError(f"Pattern {pattern_id} not found")
        
        from datetime import datetime
        pattern.verified_by = user_id
        pattern.verified_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(pattern)
        
        return pattern


def get_pattern_matcher(db: Session) -> PatternMatcherService:
    """Factory function to get PatternMatcherService instance."""
    return PatternMatcherService(db)
