# Database Update Guide

## Quick Fix for Existing Databases

If you have an existing database and are getting errors about missing columns, run these scripts:

### 1. Add Account Lockout Columns

```bash
cd Backend
python scripts/add_account_lockout_columns.py
```

This adds:
- `failed_login_attempts` (INTEGER, default 0)
- `locked_until` (DATETIME, nullable)
- `last_failed_login` (DATETIME, nullable)
- `two_factor_enabled` (BOOLEAN, default 0)
- `two_factor_secret` (VARCHAR(255), nullable)

### 2. Create Refresh Tokens Table

```bash
python scripts/add_refresh_tokens_table.py
```

This creates the `refresh_tokens` table with all required columns and indexes.

## Using Alembic Migrations (Recommended)

For a more robust solution, use Alembic migrations:

### Initial Migration

```bash
# Create initial migration (includes all current models)
alembic revision --autogenerate -m "Initial migration"

# Apply migration
alembic upgrade head
```

### Apply Existing Migrations

If migrations already exist:

```bash
# Check current revision
alembic current

# Apply all pending migrations
alembic upgrade head
```

## Migration Files Created

1. **001_add_account_lockout_columns.py** - Adds account lockout and 2FA columns
2. **002_add_refresh_tokens_table.py** - Creates refresh_tokens table

## Troubleshooting

### Error: "no such column: users.failed_login_attempts"

**Solution:** Run the update script:
```bash
python scripts/add_account_lockout_columns.py
```

### Error: "no such table: refresh_tokens"

**Solution:** Run the table creation script:
```bash
python scripts/add_refresh_tokens_table.py
```

### SQLite Limitations

SQLite has limited ALTER TABLE support:
- ✅ Can ADD COLUMN
- ❌ Cannot DROP COLUMN (without recreating table)
- ❌ Cannot MODIFY COLUMN (without recreating table)

For production, consider using PostgreSQL or Firebase Firestore.

## Production Deployment

In production, always use Alembic migrations:

```bash
# Before deploying
alembic upgrade head

# Or include in deployment script
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000
```
