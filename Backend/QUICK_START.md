# Quick Start Guide

## Fix Database Schema Issues

If you're getting errors about missing columns (`failed_login_attempts`, `locked_until`, etc.), run:

```bash
cd Backend

# Add missing columns to users table
python scripts/add_account_lockout_columns.py

# Create refresh_tokens table
python scripts/add_refresh_tokens_table.py
```

## Start the Application

```bash
cd Backend

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Start the server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The application should now start without database errors!

## Verify Installation

1. **Check Health Endpoint:**
   ```bash
   curl http://localhost:8000/api/health
   ```

2. **Check API Docs:**
   Open http://localhost:8000/docs in your browser

3. **Test Authentication:**
   ```bash
   # Register a victim
   curl -X POST http://localhost:8000/api/auth/victim/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Test User","email":"test@example.com","phone":"1234567890","password":"TestPass123!"}'
   ```

## Common Issues

### Issue: "no such column: users.failed_login_attempts"
**Solution:** Run `python scripts/add_account_lockout_columns.py`

### Issue: "no such table: refresh_tokens"
**Solution:** Run `python scripts/add_refresh_tokens_table.py`

### Issue: "ModuleNotFoundError: No module named 'prometheus_client'"
**Solution:** Run `pip install -r requirements.txt`

### Issue: Rate limiter errors
**Solution:** This is normal - Redis is optional. The app falls back to in-memory rate limiting.

## Next Steps

- See `MIGRATION_GUIDE.md` for database migration information
- See `TESTING.md` for running tests
- See `README.md` for full documentation
