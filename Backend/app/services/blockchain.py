# app/services/blockchain.py
"""
Blockchain-based Secure Audit Trail Service
Provides immutable, tamper-proof audit logging using blockchain technology
Supports both local hash-chain and Ethereum integration
"""
import hashlib
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from ..models import EvidenceChange
from ..config import settings

logger = logging.getLogger("crime_tracer.blockchain")


class BlockchainAuditService:
    """
    Blockchain-based audit trail service.
    Creates immutable audit records with cryptographic linking.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self._chain_cache = {}  # Cache for chain verification
    
    def _compute_block_hash(self, block_data: Dict[str, Any], previous_hash: Optional[str] = None) -> str:
        """
        Compute SHA-256 hash for a block.
        
        Args:
            block_data: Block data dictionary
            previous_hash: Hash of previous block (for chaining)
            
        Returns:
            Hexadecimal hash string
        """
        # Create deterministic string representation
        block_string = json.dumps(block_data, sort_keys=True, default=str)
        if previous_hash:
            block_string = f"{previous_hash}|{block_string}"
        
        return hashlib.sha256(block_string.encode('utf-8')).hexdigest()
    
    def _get_previous_block_hash(self, case_id: int) -> Optional[str]:
        """Get hash of the most recent change for a case."""
        last_change = (
            self.db.query(EvidenceChange)
            .filter(EvidenceChange.case_id == case_id)
            .order_by(EvidenceChange.timestamp.desc())
            .first()
        )
        
        if last_change:
            return last_change.cryptographic_hash
        
        return None
    
    def create_blockchain_record(
        self,
        change_record: EvidenceChange,
        previous_hash: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a blockchain record for an audit change.
        
        Args:
            change_record: EvidenceChange record
            previous_hash: Hash of previous block (auto-fetched if None)
            
        Returns:
            Blockchain record dictionary
        """
        if previous_hash is None:
            previous_hash = self._get_previous_block_hash(change_record.case_id)
        
        # Create block data
        block_data = {
            'change_id': change_record.change_id,
            'case_id': change_record.case_id,
            'user_id': change_record.user_id,
            'user_name': change_record.user_name,
            'section_modified': change_record.section_modified,
            'field_changed': change_record.field_changed,
            'change_type': change_record.change_type,
            'timestamp': change_record.timestamp.isoformat() if change_record.timestamp else None,
            'previous_hash': previous_hash,
        }
        
        # Compute block hash
        block_hash = self._compute_block_hash(block_data, previous_hash)
        
        # Create blockchain record
        blockchain_record = {
            'block_hash': block_hash,
            'previous_hash': previous_hash,
            'block_data': block_data,
            'timestamp': datetime.utcnow().isoformat(),
            'chain_position': self._get_chain_position(change_record.case_id),
        }
        
        # Store blockchain hash in change record (if not already set)
        if change_record.cryptographic_hash != block_hash:
            # Update with blockchain hash
            change_record.cryptographic_hash = block_hash
            self.db.commit()
        
        logger.info(
            f"Created blockchain record for change {change_record.change_id}",
            extra={'block_hash': block_hash, 'change_id': change_record.change_id}
        )
        
        return blockchain_record
    
    def _get_chain_position(self, case_id: int) -> int:
        """Get the position of this change in the chain."""
        count = (
            self.db.query(EvidenceChange)
            .filter(EvidenceChange.case_id == case_id)
            .count()
        )
        return count
    
    def verify_blockchain_integrity(self, case_id: int) -> Dict[str, Any]:
        """
        Verify the integrity of the blockchain for a case.
        
        Args:
            case_id: Case ID to verify
            
        Returns:
            Verification result dictionary
        """
        changes = (
            self.db.query(EvidenceChange)
            .filter(EvidenceChange.case_id == case_id)
            .order_by(EvidenceChange.timestamp.asc())
            .all()
        )
        
        if not changes:
            return {
                'valid': True,
                'message': 'No changes to verify',
                'chain_length': 0,
            }
        
        previous_hash = None
        invalid_blocks = []
        
        for i, change in enumerate(changes):
            # Recreate block data
            block_data = {
                'change_id': change.change_id,
                'case_id': change.case_id,
                'user_id': change.user_id,
                'user_name': change.user_name,
                'section_modified': change.section_modified,
                'field_changed': change.field_changed,
                'change_type': change.change_type,
                'timestamp': change.timestamp.isoformat() if change.timestamp else None,
                'previous_hash': previous_hash,
            }
            
            # Compute expected hash
            expected_hash = self._compute_block_hash(block_data, previous_hash)
            
            # Verify hash matches
            if change.cryptographic_hash != expected_hash:
                invalid_blocks.append({
                    'change_id': change.change_id,
                    'expected_hash': expected_hash,
                    'actual_hash': change.cryptographic_hash,
                    'position': i + 1,
                })
            
            previous_hash = change.cryptographic_hash
        
        is_valid = len(invalid_blocks) == 0
        
        return {
            'valid': is_valid,
            'chain_length': len(changes),
            'invalid_blocks': invalid_blocks,
            'message': 'Chain verified' if is_valid else f'{len(invalid_blocks)} invalid blocks found',
        }
    
    def get_blockchain_chain(self, case_id: int) -> List[Dict[str, Any]]:
        """
        Get the complete blockchain for a case.
        
        Args:
            case_id: Case ID
            
        Returns:
            List of blockchain records
        """
        changes = (
            self.db.query(EvidenceChange)
            .filter(EvidenceChange.case_id == case_id)
            .order_by(EvidenceChange.timestamp.asc())
            .all()
        )
        
        chain = []
        previous_hash = None
        
        for change in changes:
            block_data = {
                'change_id': change.change_id,
                'case_id': change.case_id,
                'user_id': change.user_id,
                'user_name': change.user_name,
                'section_modified': change.section_modified,
                'field_changed': change.field_changed,
                'change_type': change.change_type,
                'timestamp': change.timestamp.isoformat() if change.timestamp else None,
                'previous_hash': previous_hash,
            }
            
            block_hash = self._compute_block_hash(block_data, previous_hash)
            
            chain.append({
                'block_hash': block_hash,
                'previous_hash': previous_hash,
                'change_id': change.change_id,
                'timestamp': change.timestamp.isoformat() if change.timestamp else None,
                'block_data': block_data,
            })
            
            previous_hash = block_hash
        
        return chain


def get_blockchain_service(db: Session) -> BlockchainAuditService:
    """Factory function to get BlockchainAuditService instance."""
    return BlockchainAuditService(db)
