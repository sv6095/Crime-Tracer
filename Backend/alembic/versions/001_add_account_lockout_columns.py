"""Add account lockout and 2FA columns to users table

Revision ID: 001_add_account_lockout
Revises: 
Create Date: 2026-02-04 19:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text, inspect

# revision identifiers, used by Alembic.
revision: str = '001_add_account_lockout'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add account lockout and 2FA columns to users table."""
    # For SQLite, use raw SQL ALTER TABLE statements
    # These will fail gracefully if columns already exist
    
    # Add failed_login_attempts column
    try:
        op.execute(text("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0"))
    except Exception:
        pass  # Column might already exist
    
    # Add locked_until column
    try:
        op.execute(text("ALTER TABLE users ADD COLUMN locked_until DATETIME"))
    except Exception:
        pass
    
    # Add last_failed_login column
    try:
        op.execute(text("ALTER TABLE users ADD COLUMN last_failed_login DATETIME"))
    except Exception:
        pass
    
    # Add two_factor_enabled column
    try:
        op.execute(text("ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT 0"))
    except Exception:
        pass
    
    # Add two_factor_secret column
    try:
        op.execute(text("ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255)"))
    except Exception:
        pass


def downgrade() -> None:
    """Remove account lockout and 2FA columns from users table."""
    # Note: SQLite doesn't support DROP COLUMN directly, so this may fail
    # In production with PostgreSQL/Firebase, this would work
    try:
        op.drop_column('users', 'two_factor_secret')
        op.drop_column('users', 'two_factor_enabled')
        op.drop_column('users', 'last_failed_login')
        op.drop_column('users', 'locked_until')
        op.drop_column('users', 'failed_login_attempts')
    except Exception:
        # SQLite doesn't support DROP COLUMN - skip in downgrade
        pass
