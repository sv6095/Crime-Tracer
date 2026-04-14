# app/services/encryption.py
"""
AES-256 Encryption Service for Personal Diary Entries
Provides encryption/decryption for sensitive investigator notes
"""
import base64
import hashlib
import logging
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend

from ..config import settings

logger = logging.getLogger("crime_tracer.encryption")


class EncryptionService:
    """
    AES-256 encryption service for diary entries.
    Uses Fernet (symmetric encryption) with key derivation from SECRET_KEY.
    """
    
    def __init__(self):
        """Initialize encryption service with key derived from SECRET_KEY."""
        self._cipher_suite = None
        self._initialize_cipher()
    
    def _initialize_cipher(self):
        """Initialize Fernet cipher suite from SECRET_KEY."""
        try:
            # Derive encryption key from SECRET_KEY using PBKDF2
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b'crime_tracer_diary_salt',  # Fixed salt for consistency
                iterations=100000,
                backend=default_backend()
            )
            
            # Use SECRET_KEY as password
            key = base64.urlsafe_b64encode(
                kdf.derive(settings.SECRET_KEY.encode('utf-8'))
            )
            
            self._cipher_suite = Fernet(key)
            logger.info("Encryption service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize encryption service: {e}", exc_info=True)
            raise
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt plaintext string.
        
        Args:
            plaintext: Text to encrypt
            
        Returns:
            Base64-encoded encrypted string
        """
        if not plaintext:
            return ""
        
        try:
            encrypted_bytes = self._cipher_suite.encrypt(plaintext.encode('utf-8'))
            return base64.urlsafe_b64encode(encrypted_bytes).decode('utf-8')
        except Exception as e:
            logger.error(f"Encryption failed: {e}", exc_info=True)
            raise ValueError(f"Encryption failed: {str(e)}")
    
    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt encrypted string.
        
        Args:
            ciphertext: Base64-encoded encrypted string
            
        Returns:
            Decrypted plaintext string
        """
        if not ciphertext:
            return ""
        
        try:
            encrypted_bytes = base64.urlsafe_b64decode(ciphertext.encode('utf-8'))
            decrypted_bytes = self._cipher_suite.decrypt(encrypted_bytes)
            return decrypted_bytes.decode('utf-8')
        except Exception as e:
            logger.error(f"Decryption failed: {e}", exc_info=True)
            raise ValueError(f"Decryption failed: {str(e)}")


# Singleton instance
_encryption_service: EncryptionService = None


def get_encryption_service() -> EncryptionService:
    """Get singleton encryption service instance."""
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = EncryptionService()
    return _encryption_service
