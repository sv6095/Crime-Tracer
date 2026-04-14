# app/services/firebase_service.py
"""
Firebase Firestore service for Crime Tracer.

Provides a service layer for Firebase Firestore operations with fallback to SQLite.
This allows the application to use Firebase in production while maintaining SQLite
as a development/fallback option.
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

logger = logging.getLogger("crime_tracer.firebase")

# Try to import Firebase Admin SDK
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    logger.warning("firebase-admin not installed. Firebase features disabled.")


class DatabaseBackend(Enum):
    """Database backend types."""
    SQLITE = "sqlite"
    FIREBASE = "firebase"


class FirebaseService:
    """
    Firebase Firestore service wrapper.
    
    Provides methods for CRUD operations on Firestore collections.
    Falls back to SQLite if Firebase is not configured or unavailable.
    """
    
    def __init__(self):
        self.db: Optional[firestore.Client] = None
        self.backend: DatabaseBackend = DatabaseBackend.SQLITE
        self._initialize()
    
    def _initialize(self):
        """Initialize Firebase connection if credentials are available."""
        if not FIREBASE_AVAILABLE:
            logger.info("Firebase Admin SDK not available, using SQLite")
            return
        
        from ..config import settings
        
        # Check if Firebase credentials are configured
        if not hasattr(settings, 'FIREBASE_CREDENTIALS_PATH') or not settings.FIREBASE_CREDENTIALS_PATH:
            logger.info("Firebase credentials not configured, using SQLite")
            return
        
        try:
            # Initialize Firebase Admin SDK
            cred_path = settings.FIREBASE_CREDENTIALS_PATH
            cred = credentials.Certificate(cred_path)
            
            # Initialize app if not already initialized
            try:
                firebase_admin.get_app()
            except ValueError:
                firebase_admin.initialize_app(cred)
            
            self.db = firestore.client()
            self.backend = DatabaseBackend.FIREBASE
            logger.info("Firebase Firestore initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Firebase: {e}")
            logger.info("Falling back to SQLite")
            self.backend = DatabaseBackend.SQLITE
    
    def is_firebase_available(self) -> bool:
        """Check if Firebase is available and configured."""
        return self.backend == DatabaseBackend.FIREBASE and self.db is not None
    
    def create_document(self, collection: str, document_id: Optional[str], data: Dict[str, Any]) -> str:
        """
        Create a document in Firestore.
        
        Args:
            collection: Collection name
            document_id: Optional document ID (auto-generated if None)
            data: Document data
        
        Returns:
            Document ID
        """
        if not self.is_firebase_available():
            raise RuntimeError("Firebase is not available. Use SQLite database operations instead.")
        
        doc_ref = self.db.collection(collection)
        
        if document_id:
            doc_ref.document(document_id).set(data)
            return document_id
        else:
            doc_ref = doc_ref.add(data)
            return doc_ref[1].id
    
    def get_document(self, collection: str, document_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a document from Firestore.
        
        Args:
            collection: Collection name
            document_id: Document ID
        
        Returns:
            Document data or None if not found
        """
        if not self.is_firebase_available():
            raise RuntimeError("Firebase is not available. Use SQLite database operations instead.")
        
        doc_ref = self.db.collection(collection).document(document_id)
        doc = doc_ref.get()
        
        if doc.exists:
            data = doc.to_dict()
            data['id'] = doc.id
            return data
        return None
    
    def update_document(self, collection: str, document_id: str, data: Dict[str, Any]) -> bool:
        """
        Update a document in Firestore.
        
        Args:
            collection: Collection name
            document_id: Document ID
            data: Updated data
        
        Returns:
            True if successful
        """
        if not self.is_firebase_available():
            raise RuntimeError("Firebase is not available. Use SQLite database operations instead.")
        
        doc_ref = self.db.collection(collection).document(document_id)
        doc_ref.update(data)
        return True
    
    def delete_document(self, collection: str, document_id: str) -> bool:
        """
        Delete a document from Firestore.
        
        Args:
            collection: Collection name
            document_id: Document ID
        
        Returns:
            True if successful
        """
        if not self.is_firebase_available():
            raise RuntimeError("Firebase is not available. Use SQLite database operations instead.")
        
        doc_ref = self.db.collection(collection).document(document_id)
        doc_ref.delete()
        return True
    
    def query_collection(
        self,
        collection: str,
        filters: Optional[List[tuple]] = None,
        order_by: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Query a Firestore collection.
        
        Args:
            collection: Collection name
            filters: List of (field, operator, value) tuples
            order_by: Field to order by
            limit: Maximum number of documents to return
        
        Returns:
            List of documents
        """
        if not self.is_firebase_available():
            raise RuntimeError("Firebase is not available. Use SQLite database operations instead.")
        
        query = self.db.collection(collection)
        
        # Apply filters
        if filters:
            for field, operator, value in filters:
                if operator == "==":
                    query = query.where(field, "==", value)
                elif operator == ">":
                    query = query.where(field, ">", value)
                elif operator == "<":
                    query = query.where(field, "<", value)
                elif operator == ">=":
                    query = query.where(field, ">=", value)
                elif operator == "<=":
                    query = query.where(field, "<=", value)
                elif operator == "in":
                    query = query.where(field, "in", value)
        
        # Apply ordering
        if order_by:
            query = query.order_by(order_by)
        
        # Apply limit
        if limit:
            query = query.limit(limit)
        
        docs = query.stream()
        results = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            results.append(data)
        
        return results
    
    def batch_write(self, operations: List[Dict[str, Any]]) -> bool:
        """
        Perform batch write operations.
        
        Args:
            operations: List of operation dicts with keys:
                - type: 'create', 'update', 'delete'
                - collection: Collection name
                - document_id: Document ID
                - data: Document data (for create/update)
        
        Returns:
            True if successful
        """
        if not self.is_firebase_available():
            raise RuntimeError("Firebase is not available. Use SQLite database operations instead.")
        
        batch = self.db.batch()
        
        for op in operations:
            op_type = op.get('type')
            collection = op.get('collection')
            document_id = op.get('document_id')
            data = op.get('data', {})
            
            doc_ref = self.db.collection(collection).document(document_id)
            
            if op_type == 'create':
                batch.set(doc_ref, data)
            elif op_type == 'update':
                batch.update(doc_ref, data)
            elif op_type == 'delete':
                batch.delete(doc_ref)
        
        batch.commit()
        return True


# Global Firebase service instance
_firebase_service: Optional[FirebaseService] = None


def get_firebase_service() -> FirebaseService:
    """Get or create the global Firebase service instance."""
    global _firebase_service
    if _firebase_service is None:
        _firebase_service = FirebaseService()
    return _firebase_service


def is_firebase_enabled() -> bool:
    """Check if Firebase is enabled and available."""
    service = get_firebase_service()
    return service.is_firebase_available()
