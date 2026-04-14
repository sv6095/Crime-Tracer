"""Add investigation platform tables

Revision ID: 003_add_investigation_platform
Revises: 002_add_refresh_tokens
Create Date: 2026-02-04 20:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003_add_investigation_platform'
down_revision: Union[str, None] = '002_add_refresh_tokens'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create investigation platform tables."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    
    # Create investigation_diary table
    if 'investigation_diary' not in tables:
        op.create_table(
            'investigation_diary',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('case_id', sa.Integer(), nullable=False),
            sa.Column('investigator_id', sa.Integer(), nullable=False),
            sa.Column('entry_type', sa.String(50), nullable=False),
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('encrypted', sa.Boolean(), nullable=True, server_default='1'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.Column('deleted_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['case_id'], ['complaints.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['investigator_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_investigation_diary_case_id'), 'investigation_diary', ['case_id'], unique=False)
        op.create_index(op.f('ix_investigation_diary_investigator_id'), 'investigation_diary', ['investigator_id'], unique=False)
        op.create_index(op.f('ix_investigation_diary_created_at'), 'investigation_diary', ['created_at'], unique=False)
    
    # Create evidence_changes table (immutable audit trail)
    if 'evidence_changes' not in tables:
        op.create_table(
            'evidence_changes',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('change_id', sa.String(64), nullable=False),
            sa.Column('case_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('user_name', sa.String(255), nullable=False),
            sa.Column('section_modified', sa.String(50), nullable=False),
            sa.Column('field_changed', sa.String(255), nullable=True),
            sa.Column('change_type', sa.String(20), nullable=False),
            sa.Column('old_value', sa.Text(), nullable=True),
            sa.Column('new_value', sa.Text(), nullable=True),
            sa.Column('details', sa.Text(), nullable=True),
            sa.Column('cryptographic_hash', sa.String(64), nullable=False),
            sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
            sa.Column('ip_address', sa.String(45), nullable=True),
            sa.Column('user_agent', sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(['case_id'], ['complaints.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('change_id')
        )
        op.create_index(op.f('ix_evidence_changes_change_id'), 'evidence_changes', ['change_id'], unique=True)
        op.create_index(op.f('ix_evidence_changes_case_id'), 'evidence_changes', ['case_id'], unique=False)
        op.create_index(op.f('ix_evidence_changes_user_id'), 'evidence_changes', ['user_id'], unique=False)
        op.create_index(op.f('ix_evidence_changes_cryptographic_hash'), 'evidence_changes', ['cryptographic_hash'], unique=False)
        op.create_index(op.f('ix_evidence_changes_timestamp'), 'evidence_changes', ['timestamp'], unique=False)
        op.create_index('idx_evidence_changes_case_timestamp', 'evidence_changes', ['case_id', 'timestamp'], unique=False)
        op.create_index('idx_evidence_changes_user_timestamp', 'evidence_changes', ['user_id', 'timestamp'], unique=False)
    
    # Create case_patterns table
    if 'case_patterns' not in tables:
        op.create_table(
            'case_patterns',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('case_id', sa.Integer(), nullable=False),
            sa.Column('related_case_id', sa.Integer(), nullable=False),
            sa.Column('pattern_type', sa.String(50), nullable=False),
            sa.Column('confidence_score', sa.Numeric(5, 2), nullable=False),
            sa.Column('match_details', sa.JSON(), nullable=True),
            sa.Column('detected_at', sa.DateTime(), nullable=True),
            sa.Column('verified_by', sa.Integer(), nullable=True),
            sa.Column('verified_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['case_id'], ['complaints.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['related_case_id'], ['complaints.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['verified_by'], ['users.id']),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_case_patterns_case_id'), 'case_patterns', ['case_id'], unique=False)
        op.create_index(op.f('ix_case_patterns_related_case_id'), 'case_patterns', ['related_case_id'], unique=False)
        op.create_index(op.f('ix_case_patterns_detected_at'), 'case_patterns', ['detected_at'], unique=False)
    
    # Create forensic_analysis table
    if 'forensic_analysis' not in tables:
        op.create_table(
            'forensic_analysis',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('evidence_id', sa.Integer(), nullable=False),
            sa.Column('analysis_type', sa.String(50), nullable=False),
            sa.Column('analysis_result', sa.JSON(), nullable=False),
            sa.Column('model_version', sa.String(100), nullable=True),
            sa.Column('confidence_score', sa.Numeric(5, 2), nullable=True),
            sa.Column('processing_time_ms', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['evidence_id'], ['evidence.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_forensic_analysis_evidence_id'), 'forensic_analysis', ['evidence_id'], unique=False)
        op.create_index(op.f('ix_forensic_analysis_created_at'), 'forensic_analysis', ['created_at'], unique=False)
    
    # Add enhanced fields to evidence table if they don't exist
    try:
        op.add_column('evidence', sa.Column('chain_of_custody', sa.JSON(), nullable=True))
    except Exception:
        pass  # Column might already exist
    
    try:
        op.add_column('evidence', sa.Column('forensic_tags', sa.JSON(), nullable=True))
    except Exception:
        pass
    
    try:
        op.add_column('evidence', sa.Column('yolo_detections', sa.JSON(), nullable=True))
    except Exception:
        pass
    
    try:
        op.add_column('evidence', sa.Column('ocr_text', sa.Text(), nullable=True))
    except Exception:
        pass
    
    try:
        op.add_column('evidence', sa.Column('voice_analysis', sa.JSON(), nullable=True))
    except Exception:
        pass


def downgrade() -> None:
    """Drop investigation platform tables."""
    # Drop indexes first
    try:
        op.drop_index('idx_evidence_changes_user_timestamp', table_name='evidence_changes')
        op.drop_index('idx_evidence_changes_case_timestamp', table_name='evidence_changes')
        op.drop_index(op.f('ix_evidence_changes_timestamp'), table_name='evidence_changes')
        op.drop_index(op.f('ix_evidence_changes_cryptographic_hash'), table_name='evidence_changes')
        op.drop_index(op.f('ix_evidence_changes_user_id'), table_name='evidence_changes')
        op.drop_index(op.f('ix_evidence_changes_case_id'), table_name='evidence_changes')
        op.drop_index(op.f('ix_evidence_changes_change_id'), table_name='evidence_changes')
    except Exception:
        pass
    
    try:
        op.drop_index(op.f('ix_forensic_analysis_created_at'), table_name='forensic_analysis')
        op.drop_index(op.f('ix_forensic_analysis_evidence_id'), table_name='forensic_analysis')
    except Exception:
        pass
    
    try:
        op.drop_index(op.f('ix_case_patterns_detected_at'), table_name='case_patterns')
        op.drop_index(op.f('ix_case_patterns_related_case_id'), table_name='case_patterns')
        op.drop_index(op.f('ix_case_patterns_case_id'), table_name='case_patterns')
    except Exception:
        pass
    
    try:
        op.drop_index(op.f('ix_investigation_diary_created_at'), table_name='investigation_diary')
        op.drop_index(op.f('ix_investigation_diary_investigator_id'), table_name='investigation_diary')
        op.drop_index(op.f('ix_investigation_diary_case_id'), table_name='investigation_diary')
    except Exception:
        pass
    
    # Drop tables
    op.drop_table('forensic_analysis')
    op.drop_table('case_patterns')
    op.drop_table('evidence_changes')
    op.drop_table('investigation_diary')
    
    # Remove enhanced fields from evidence table
    try:
        op.drop_column('evidence', 'voice_analysis')
    except Exception:
        pass
    
    try:
        op.drop_column('evidence', 'ocr_text')
    except Exception:
        pass
    
    try:
        op.drop_column('evidence', 'yolo_detections')
    except Exception:
        pass
    
    try:
        op.drop_column('evidence', 'forensic_tags')
    except Exception:
        pass
    
    try:
        op.drop_column('evidence', 'chain_of_custody')
    except Exception:
        pass
