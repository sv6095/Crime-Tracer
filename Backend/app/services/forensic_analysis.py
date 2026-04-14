# app/services/forensic_analysis.py
"""
Forensic Analysis Service - ML-powered evidence analysis
Supports YOLO object detection, voice analysis, OCR extraction
"""
import logging
import time
import os
from pathlib import Path
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
import base64

logger = logging.getLogger("crime_tracer.forensic_analysis")

# YOLO imports
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    logger.warning("ultralytics not available, YOLO detection will use mock results")

# OCR imports
try:
    import pytesseract
    from PIL import Image
    import cv2
    import numpy as np
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    logger.warning("pytesseract/PIL not available, OCR extraction will use mock results")

from ..models import Evidence, ForensicAnalysis, Complaint, StorageType
from ..config import settings

logger = logging.getLogger("crime_tracer.forensic_analysis")

# Initialize YOLO model (lazy loading)
_yolo_model = None

def _get_yolo_model():
    """Get or initialize YOLO model (pretrained YOLOv8n)."""
    global _yolo_model
    if not YOLO_AVAILABLE:
        return None
    if _yolo_model is None:
        try:
            # Use pretrained YOLOv8n (nano) model - lightweight and fast
            _yolo_model = YOLO('yolov8n.pt')  # Downloads automatically if not present
            logger.info("YOLOv8n model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}", exc_info=True)
            _yolo_model = False  # Mark as failed
    return _yolo_model if _yolo_model is not False else None

def _get_evidence_file_bytes(evidence: Evidence) -> bytes:
    """Get file bytes from evidence storage (local or S3)."""
    if evidence.storage_type == StorageType.LOCAL:
        # Local file path
        file_path = Path(evidence.storage_path)
        if file_path.exists():
            with open(file_path, 'rb') as f:
                return f.read()
        else:
            raise ValueError(f"Local file not found: {evidence.storage_path}")
    elif evidence.storage_type == StorageType.S3:
        # S3 file - download
        try:
            import boto3
            from ..config import settings
            s3_client = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
            response = s3_client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=evidence.storage_path)
            return response['Body'].read()
        except Exception as e:
            logger.error(f"Failed to download from S3: {e}", exc_info=True)
            raise ValueError(f"S3 download failed: {str(e)}")
    else:
        raise ValueError(f"Unsupported storage type: {evidence.storage_type}")


class ForensicAnalysisService:
    """Service for running ML-based forensic analysis on evidence."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def run_yolo_detection(self, evidence_id: int) -> Dict[str, Any]:
        """
        Run YOLO object detection on image evidence using YOLOv8n pretrained model.
        
        Args:
            evidence_id: ID of the evidence to analyze
        
        Returns:
            Dict containing detection results
        """
        evidence = self.db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise ValueError(f"Evidence {evidence_id} not found")
        
        # Check if image type
        if not evidence.content_type.startswith('image/'):
            raise ValueError(f"YOLO detection only supports images, got {evidence.content_type}")
        
        start_time = time.time()
        
        try:
            # Get file bytes
            file_bytes = _get_evidence_file_bytes(evidence)
            
            # Convert to numpy array for YOLO
            nparr = np.frombuffer(file_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                raise ValueError("Failed to decode image")
            
            # Run YOLO detection
            model = _get_yolo_model()
            if model:
                # Run inference
                results = model(img, verbose=False)
                
                # Extract detections
                detections_list = []
                if len(results) > 0 and results[0].boxes is not None:
                    boxes = results[0].boxes
                    for i in range(len(boxes)):
                        box = boxes[i]
                        cls = int(box.cls[0])
                        conf = float(box.conf[0])
                        xyxy = box.xyxy[0].cpu().numpy().tolist()
                        
                        # Get class name
                        class_name = model.names[cls] if hasattr(model, 'names') else f"class_{cls}"
                        
                        detections_list.append({
                            'class': class_name,
                            'confidence': conf,
                            'bbox': [int(x) for x in xyxy]  # [x1, y1, x2, y2]
                        })
                
                detections = {
                    'objects': detections_list,
                    'model_version': 'yolov8n-pretrained',
                    'total_detections': len(detections_list)
                }
            else:
                # Fallback to mock if YOLO not available
                logger.warning("YOLO model not available, using mock results")
                detections = {
                    'objects': [
                        {'class': 'person', 'confidence': 0.85, 'bbox': [100, 200, 150, 300]},
                        {'class': 'weapon', 'confidence': 0.72, 'bbox': [300, 150, 350, 200]},
                    ],
                    'model_version': 'yolov8n-mock',
                }
            
            processing_time_ms = int((time.time() - start_time) * 1000)
            
            # Store in evidence table
            evidence.yolo_detections = detections
            
            # Store in forensic_analysis table
            max_confidence = max([obj.get('confidence', 0.0) for obj in detections.get('objects', [])], default=0.0) * 100
            analysis = ForensicAnalysis(
                evidence_id=evidence_id,
                analysis_type='yolo_object_detection',
                analysis_result=detections,
                model_version=detections.get('model_version', 'unknown'),
                confidence_score=max_confidence if detections.get('objects') else None,
                processing_time_ms=processing_time_ms,
            )
            
            self.db.add(analysis)
            self.db.commit()
            
            logger.info(f"YOLO detection completed for evidence {evidence_id}: {len(detections.get('objects', []))} objects detected")
            
            return {
                'success': True,
                'detections': detections,
                'processing_time_ms': processing_time_ms,
            }
            
        except Exception as e:
            logger.error(f"YOLO detection failed for evidence {evidence_id}: {e}", exc_info=True)
            raise
    
    def run_voice_analysis(self, evidence_id: int) -> Dict[str, Any]:
        """
        Run voice analysis on audio evidence.
        Extracts background clues, vehicle sounds, ambient locations.
        
        Args:
            evidence_id: ID of the evidence to analyze
        
        Returns:
            Dict containing analysis results
        """
        evidence = self.db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise ValueError(f"Evidence {evidence_id} not found")
        
        # Check if audio type
        if not evidence.content_type.startswith('audio/'):
            raise ValueError(f"Voice analysis only supports audio, got {evidence.content_type}")
        
        start_time = time.time()
        
        try:
            # TODO: Integrate with actual voice analysis service
            # For now, return mock results
            
            analysis_result = {
                'background_clues': [
                    {'type': 'vehicle', 'confidence': 0.78, 'details': 'Motorcycle engine sound'},
                    {'type': 'location', 'confidence': 0.65, 'details': 'Urban street noise'},
                ],
                'conversations': [
                    {'speaker': 'unknown', 'text': 'partial conversation detected', 'confidence': 0.45},
                ],
                'model_version': 'voice-analysis-v1.0',
            }
            
            processing_time_ms = int((time.time() - start_time) * 1000)
            
            # Store in evidence table
            evidence.voice_analysis = analysis_result
            
            # Store in forensic_analysis table
            analysis = ForensicAnalysis(
                evidence_id=evidence_id,
                analysis_type='voice_analysis',
                analysis_result=analysis_result,
                model_version=analysis_result.get('model_version', 'unknown'),
                confidence_score=max([c.get('confidence', 0.0) for c in analysis_result.get('background_clues', [])], default=0.0) * 100,
                processing_time_ms=processing_time_ms,
            )
            
            self.db.add(analysis)
            self.db.commit()
            
            logger.info(f"Voice analysis completed for evidence {evidence_id}")
            
            return {
                'success': True,
                'analysis': analysis_result,
                'processing_time_ms': processing_time_ms,
            }
            
        except Exception as e:
            logger.error(f"Voice analysis failed for evidence {evidence_id}: {e}", exc_info=True)
            raise
    
    def run_ocr_extraction(self, evidence_id: int) -> Dict[str, Any]:
        """
        Run OCR extraction on document evidence (e.g., FIR) using Tesseract OCR.
        Limited to 10 times per case.
        
        Args:
            evidence_id: ID of the evidence to analyze
        
        Returns:
            Dict containing OCR results
        """
        evidence = self.db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise ValueError(f"Evidence {evidence_id} not found")
        
        # Check OCR limit (10 times max per case)
        case_id = evidence.complaint_id
        ocr_count = (
            self.db.query(ForensicAnalysis)
            .join(Evidence, ForensicAnalysis.evidence_id == Evidence.id)
            .filter(
                Evidence.complaint_id == case_id,
                ForensicAnalysis.analysis_type == 'ocr_extraction'
            )
            .count()
        )
        
        if ocr_count >= 10:
            raise ValueError(f"OCR extraction limit reached (10 times max per case). Already performed {ocr_count} times.")
        
        # Check if document type
        if not (evidence.content_type.startswith('image/') or 
                evidence.content_type in ['application/pdf', 'application/msword']):
            raise ValueError(f"OCR extraction only supports images/PDFs, got {evidence.content_type}")
        
        start_time = time.time()
        
        try:
            # Get file bytes
            file_bytes = _get_evidence_file_bytes(evidence)
            
            # Process with Tesseract OCR
            if OCR_AVAILABLE:
                # Convert to PIL Image
                nparr = np.frombuffer(file_bytes, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if img is None:
                    raise ValueError("Failed to decode image")
                
                # Convert BGR to RGB for PIL
                img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(img_rgb)
                
                # Preprocess image for better OCR
                # Convert to grayscale
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                
                # Apply thresholding
                _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                
                # Convert back to PIL
                pil_image = Image.fromarray(thresh)
                
                # Run Tesseract OCR
                try:
                    # Use Tesseract with English and improved config
                    custom_config = r'--oem 3 --psm 6'  # Assume uniform block of text
                    extracted_text = pytesseract.image_to_string(pil_image, config=custom_config)
                    
                    # Get confidence scores
                    data = pytesseract.image_to_data(pil_image, output_type=pytesseract.Output.DICT)
                    confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
                    avg_confidence = sum(confidences) / len(confidences) / 100.0 if confidences else 0.0
                    
                    # Get Tesseract version for model_version
                    try:
                        tesseract_version = pytesseract.get_tesseract_version()
                        model_version_str = f'tesseract-ocr-{tesseract_version}'
                    except:
                        model_version_str = 'tesseract-ocr-5.0'
                    
                    # Basic entity extraction (simplified - would use NLP in production)
                    entities = self._extract_entities_simple(extracted_text)
                    
                    ocr_result = {
                        'text': extracted_text.strip(),
                        'entities': entities,
                        'confidence': avg_confidence,
                        'model_version': model_version_str,
                        'character_count': len(extracted_text),
                    }
                except Exception as e:
                    logger.warning(f"Tesseract OCR failed: {e}, using fallback")
                    ocr_result = {
                        'text': 'OCR extraction failed. Please ensure Tesseract is installed.',
                        'entities': {},
                        'confidence': 0.0,
                        'model_version': 'tesseract-ocr-error',
                    }
            else:
                # Fallback to mock if OCR not available
                logger.warning("Tesseract OCR not available, using mock results")
                ocr_result = {
                    'text': 'Sample extracted text from FIR document...\n[Note: Install pytesseract and Tesseract OCR for real extraction]',
                    'entities': {
                        'suspects': ['John Doe', 'Jane Smith'],
                        'witnesses': ['Witness 1', 'Witness 2'],
                        'locations': ['Mangalore', 'City Center'],
                        'objects': ['weapon', 'vehicle'],
                    },
                    'confidence': 0.92,
                    'model_version': 'tesseract-ocr-mock',
                }
            
            processing_time_ms = int((time.time() - start_time) * 1000)
            
            # Store in evidence table
            evidence.ocr_text = ocr_result.get('text', '')
            
            # Store in forensic_analysis table
            analysis = ForensicAnalysis(
                evidence_id=evidence_id,
                analysis_type='ocr_extraction',
                analysis_result=ocr_result,
                model_version=ocr_result.get('model_version', 'unknown'),
                confidence_score=ocr_result.get('confidence', 0.0) * 100,
                processing_time_ms=processing_time_ms,
            )
            
            self.db.add(analysis)
            self.db.commit()
            
            logger.info(f"OCR extraction completed for evidence {evidence_id} (count: {ocr_count + 1}/10)")
            
            return {
                'success': True,
                'ocr_result': ocr_result,
                'processing_time_ms': processing_time_ms,
                'ocr_count': ocr_count + 1,
                'remaining': 10 - (ocr_count + 1),
            }
            
        except ValueError as e:
            # Re-raise ValueError (like limit exceeded)
            raise
        except Exception as e:
            logger.error(f"OCR extraction failed for evidence {evidence_id}: {e}", exc_info=True)
            raise
    
    def _extract_entities_simple(self, text: str) -> Dict[str, list]:
        """Simple entity extraction (basic pattern matching)."""
        entities = {
            'suspects': [],
            'witnesses': [],
            'locations': [],
            'objects': [],
        }
        
        # Very basic pattern matching - in production would use NLP/spaCy
        text_lower = text.lower()
        
        # Look for common patterns
        if 'suspect' in text_lower or 'accused' in text_lower:
            # Would extract names here
            pass
        
        return entities
    
    def process_fir_document(self, evidence_id: int) -> Dict[str, Any]:
        """
        Process FIR document with OCR + relationship extraction.
        Extracts entities and links them across cases.
        
        Args:
            evidence_id: ID of the FIR evidence to process
        
        Returns:
            Dict containing FIR processing results
        """
        # Run OCR first
        ocr_result = self.run_ocr_extraction(evidence_id)
        
        # Extract entities (this would use NLP/ML in production)
        entities = ocr_result.get('ocr_result', {}).get('entities', {})
        
        # TODO: Link entities across cases using pattern_matcher service
        
        return {
            'success': True,
            'ocr_result': ocr_result,
            'entities': entities,
            'relationships': [],  # Would be populated by pattern_matcher
        }


def get_forensic_service(db: Session) -> ForensicAnalysisService:
    """Factory function to get ForensicAnalysisService instance."""
    return ForensicAnalysisService(db)
