"""
Tests for database migration system.

Tests:
- Alembic configuration
- Migration creation and application
- Database schema versioning
"""

import pytest
import os
import tempfile
from pathlib import Path
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory

from app.db import engine, Base
from app.models import User, RefreshToken, Complaint, Station, AuditLog


class TestAlembicConfiguration:
    """Test Alembic configuration."""
    
    def test_alembic_config_exists(self):
        """Test that alembic.ini exists."""
        alembic_ini = Path(__file__).parent.parent / "alembic.ini"
        assert alembic_ini.exists(), "alembic.ini should exist"
    
    def test_alembic_env_exists(self):
        """Test that alembic/env.py exists."""
        alembic_env = Path(__file__).parent.parent / "alembic" / "env.py"
        assert alembic_env.exists(), "alembic/env.py should exist"
    
    def test_alembic_config_loads(self):
        """Test that Alembic config can be loaded."""
        alembic_ini = Path(__file__).parent.parent / "alembic.ini"
        config = Config(str(alembic_ini))
        
        assert config is not None
        assert config.get_main_option("script_location") == "alembic"
    
    def test_alembic_script_directory(self):
        """Test that Alembic script directory is accessible."""
        alembic_ini = Path(__file__).parent.parent / "alembic.ini"
        config = Config(str(alembic_ini))
        
        script = ScriptDirectory.from_config(config)
        assert script is not None


class TestDatabaseMigrations:
    """Test database migration operations."""
    
    @pytest.fixture
    def temp_db(self):
        """Create a temporary database for testing."""
        fd, path = tempfile.mkstemp(suffix='.db')
        os.close(fd)
        
        db_url = f"sqlite:///{path}"
        test_engine = create_engine(db_url)
        SessionLocal = sessionmaker(bind=test_engine)
        
        yield test_engine, SessionLocal, path
        
        # Cleanup
        os.unlink(path)
    
    def test_models_have_table_names(self):
        """Test that all models have table names defined."""
        models_to_check = [User, RefreshToken, Complaint, Station, AuditLog]
        
        for model in models_to_check:
            assert hasattr(model, '__tablename__'), f"{model.__name__} should have __tablename__"
            assert model.__tablename__ is not None
    
    def test_base_metadata_contains_tables(self):
        """Test that Base.metadata contains all model tables."""
        tables = Base.metadata.tables.keys()
        
        expected_tables = [
            'users', 'refresh_tokens', 'complaints', 'stations', 
            'audit_logs', 'cases', 'evidence', 'notes'
        ]
        
        for table in expected_tables:
            assert table in tables, f"Table {table} should be in metadata"
    
    def test_database_schema_matches_models(self):
        """Test that database schema matches model definitions."""
        # Create all tables
        Base.metadata.create_all(bind=engine)
        
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        # Check that key tables exist
        assert 'users' in tables
        assert 'refresh_tokens' in tables
        assert 'complaints' in tables
    
    def test_refresh_token_table_exists(self):
        """Test that refresh_tokens table exists with correct columns."""
        Base.metadata.create_all(bind=engine)
        
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('refresh_tokens')]
        
        expected_columns = ['id', 'user_id', 'token', 'expires_at', 'created_at', 'revoked', 'revoked_at']
        for col in expected_columns:
            assert col in columns, f"Column {col} should exist in refresh_tokens table"
    
    def test_user_table_has_lockout_fields(self):
        """Test that users table has account lockout fields."""
        Base.metadata.create_all(bind=engine)
        
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('users')]
        
        lockout_fields = ['failed_login_attempts', 'locked_until', 'last_failed_login']
        for field in lockout_fields:
            assert field in columns, f"Field {field} should exist in users table"
    
    def test_user_table_has_2fa_fields(self):
        """Test that users table has 2FA fields."""
        Base.metadata.create_all(bind=engine)
        
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('users')]
        
        two_fa_fields = ['two_factor_enabled', 'two_factor_secret']
        for field in two_fa_fields:
            assert field in columns, f"Field {field} should exist in users table"


class TestMigrationScripts:
    """Test migration script functionality."""
    
    def test_migration_script_exists(self):
        """Test that run_migrations.py script exists."""
        script_path = Path(__file__).parent.parent / "scripts" / "run_migrations.py"
        assert script_path.exists(), "run_migrations.py should exist"
    
    def test_migration_guide_exists(self):
        """Test that MIGRATION_GUIDE.md exists."""
        guide_path = Path(__file__).parent.parent / "MIGRATION_GUIDE.md"
        assert guide_path.exists(), "MIGRATION_GUIDE.md should exist"
