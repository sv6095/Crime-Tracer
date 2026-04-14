# Database Migration Guide

This guide explains how to use Alembic migrations in the Crime Tracer backend.

## Quick Start

### 1. Create Your First Migration

After making changes to models in `app/models.py`:

```bash
cd Backend
alembic revision --autogenerate -m "Initial migration"
```

This will create a migration file in `alembic/versions/` with all the current model definitions.

### 2. Review the Migration

**Always review auto-generated migrations before applying them!**

Open the generated file in `alembic/versions/` and verify:
- All model changes are correctly captured
- No unintended changes are included
- Data migrations (if any) are correct

### 3. Apply Migrations

```bash
# Apply all pending migrations
alembic upgrade head

# Or apply one at a time
alembic upgrade +1
```

### 4. Check Status

```bash
# See current database revision
alembic current

# See migration history
alembic history
```

## Common Workflows

### Adding a New Model

1. Add the model class to `app/models.py`
2. Create migration: `alembic revision --autogenerate -m "Add User model"`
3. Review the migration file
4. Apply: `alembic upgrade head`

### Modifying an Existing Model

1. Modify the model in `app/models.py`
2. Create migration: `alembic revision --autogenerate -m "Add email field to User"`
3. Review the migration file
4. Apply: `alembic upgrade head`

### Rolling Back

```bash
# Rollback one migration
alembic downgrade -1

# Rollback to a specific revision
alembic downgrade <revision_id>

# Rollback all migrations
alembic downgrade base
```

## Production Deployment

### Option 1: Run Migrations Manually

```bash
# SSH into production server
cd /path/to/backend
source .venv/bin/activate
alembic upgrade head
```

### Option 2: Include in Deployment Script

Add to your deployment script:

```bash
#!/bin/bash
# ... other deployment steps ...
cd Backend
alembic upgrade head
# ... start application ...
```

### Option 3: Docker Compose

Add a migration service to `docker-compose.yml`:

```yaml
services:
  migrations:
    build: ./Backend
    command: alembic upgrade head
    volumes:
      - ./Backend:/app
    environment:
      - SQLALCHEMY_DATABASE_URL=${DATABASE_URL}
    depends_on:
      - db
```

## Best Practices

1. **Always test migrations on a development database first**
2. **Backup your database before running migrations in production**
3. **Never edit existing migration files** - create new migrations instead
4. **Use descriptive migration messages** - e.g., "Add refresh_token table"
5. **Review auto-generated migrations** - Alembic can miss some changes
6. **Keep migrations small and focused** - one logical change per migration
7. **Test rollback procedures** - ensure `downgrade` works correctly

## Troubleshooting

### Migration Conflicts

If you have conflicts between branches:

```bash
# Merge migrations
alembic merge -m "Merge branch migrations" <rev1> <rev2>
```

### Migration Not Detecting Changes

If Alembic doesn't detect your model changes:

1. Ensure models are imported in `alembic/env.py` (they should be via `Base.metadata`)
2. Check that your model inherits from `Base`
3. Try creating a manual migration: `alembic revision -m "Manual migration"`

### Database Out of Sync

If your database is out of sync with migrations:

```bash
# Stamp database to current revision (if migrations already applied manually)
alembic stamp head

# Or stamp to a specific revision
alembic stamp <revision_id>
```

## Firebase Firestore Notes

- Migrations are for SQLite/PostgreSQL databases only
- Firebase Firestore is schema-less and doesn't require migrations
- The Firebase service (`app/services/firebase_service.py`) handles schema changes automatically
- When using Firebase, ensure your application code handles schema evolution gracefully
