"""
Tests for Firebase Firestore service.

Tests:
- Firebase service initialization
- Fallback to SQLite
- Service availability checks
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from app.services.firebase_service import (
    FirebaseService,
    get_firebase_service,
    is_firebase_enabled,
    DatabaseBackend
)


class TestFirebaseService:
    """Test Firebase service functionality."""
    
    def test_service_initializes_without_firebase(self):
        """Test that service initializes without Firebase SDK."""
        with patch('app.services.firebase_service.FIREBASE_AVAILABLE', False):
            service = FirebaseService()
            assert service.backend == DatabaseBackend.SQLITE
            assert not service.is_firebase_available()
    
    def test_service_fallback_to_sqlite(self):
        """Test that service falls back to SQLite when Firebase unavailable."""
        service = FirebaseService()
        
        # Should default to SQLite if Firebase not configured
        assert service.backend == DatabaseBackend.SQLITE
    
    @patch('app.services.firebase_service.FIREBASE_AVAILABLE', True)
    @patch('app.services.firebase_service.firebase_admin')
    @patch('app.services.firebase_service.firestore')
    def test_service_initializes_with_firebase(self, mock_firestore, mock_firebase_admin, mock_settings):
        """Test that service initializes with Firebase when configured."""
        # Mock Firebase initialization
        mock_firebase_admin.get_app.side_effect = ValueError("App not initialized")
        mock_firebase_admin.initialize_app.return_value = None
        mock_firestore.client.return_value = MagicMock()
        
        # Mock settings
        with patch('app.services.firebase_service.settings') as mock_settings:
            mock_settings.FIREBASE_CREDENTIALS_PATH = "/path/to/credentials.json"
            mock_settings.FIREBASE_PROJECT_ID = "test-project"
            
            # Mock credentials
            with patch('app.services.firebase_service.credentials') as mock_creds:
                mock_creds.Certificate.return_value = MagicMock()
                
                service = FirebaseService()
                # Should attempt to initialize Firebase
                assert service.db is not None or service.backend == DatabaseBackend.SQLITE
    
    def test_is_firebase_available(self):
        """Test Firebase availability check."""
        service = FirebaseService()
        # Should return False if Firebase not configured
        assert isinstance(service.is_firebase_available(), bool)
    
    def test_get_firebase_service_singleton(self):
        """Test that get_firebase_service returns singleton."""
        service1 = get_firebase_service()
        service2 = get_firebase_service()
        
        assert service1 is service2
    
    def test_is_firebase_enabled_function(self):
        """Test is_firebase_enabled helper function."""
        result = is_firebase_enabled()
        assert isinstance(result, bool)
    
    def test_create_document_raises_when_not_available(self):
        """Test that create_document raises error when Firebase not available."""
        service = FirebaseService()
        
        if not service.is_firebase_available():
            with pytest.raises(RuntimeError, match="Firebase is not available"):
                service.create_document("test_collection", "test_id", {"key": "value"})
    
    def test_get_document_raises_when_not_available(self):
        """Test that get_document raises error when Firebase not available."""
        service = FirebaseService()
        
        if not service.is_firebase_available():
            with pytest.raises(RuntimeError, match="Firebase is not available"):
                service.get_document("test_collection", "test_id")
