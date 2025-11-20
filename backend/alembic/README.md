# Database Migrations

This directory contains Alembic database migrations for the ADAM AI application.

## Setup

1. Ensure PostgreSQL is running:
```bash
# Using Docker
docker run --name adam-postgres -e POSTGRES_PASSWORD=adam_password -e POSTGRES_USER=adam_user -e POSTGRES_DB=adam_ai -p 5432:5432 -d postgres:15
```

2. Set DATABASE_URL environment variable:
```bash
export DATABASE_URL="postgresql+asyncpg://adam_user:adam_password@localhost:5432/adam_ai"
```

## Commands

### Create a new migration (auto-generate from models)
```bash
cd backend
alembic revision --autogenerate -m "description of changes"
```

### Apply migrations (upgrade to latest)
```bash
alembic upgrade head
```

### Rollback last migration
```bash
alembic downgrade -1
```

### View migration history
```bash
alembic history
```

### View current database version
```bash
alembic current
```

## Migration Best Practices

1. **Always review auto-generated migrations** - Alembic may not detect all changes
2. **Test migrations on development database first**
3. **Never modify existing migrations** - Create new ones instead
4. **Include data migrations when needed** - Use op.execute() for data changes
5. **Add indexes for foreign keys** - Important for performance

## Initial Migration

The initial migration creates all tables:
- users
- audit_entries
- electronic_signatures
- code_snippets
- datasets
- variables
- define_xml

All tables include proper indexes, foreign keys, and constraints for 21 CFR Part 11 compliance.
