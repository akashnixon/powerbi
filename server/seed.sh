#!/bin/bash

echo "=============================================="
echo "   PowerBI Secure Portal - Database Seeder    "
echo "=============================================="

# Set DB variables (same as .env)
DB_NAME="powerbi_portal"
DB_USER="powerbi_user"
DB_CONTAINER="powerbi-db"

# Paths
SQL_DIR="./db"
CREATE_SQL="$SQL_DIR/create_tables.sql"
INSERT_SQL="$SQL_DIR/insert_default_users.sql"

# Check required SQL files
if [[ ! -f "$CREATE_SQL" ]]; then
    echo "❌ ERROR: Missing file: $CREATE_SQL"
    exit 1
fi

if [[ ! -f "$INSERT_SQL" ]]; then
    echo "❌ ERROR: Missing file: $INSERT_SQL"
    exit 1
fi

echo "✔ SQL files found."

# Detect Docker
if docker ps >/dev/null 2>&1; then
    DOCKER_RUNNING=true
else
    DOCKER_RUNNING=false
fi

# Detect if the postgres container exists and is running
if $DOCKER_RUNNING; then
    CONTAINER_EXISTS=$(docker ps -a --format "{{.Names}}" | grep -w "$DB_CONTAINER")
else
    CONTAINER_EXISTS=""
fi

# If Postgres is in Docker
if [[ "$CONTAINER_EXISTS" == "$DB_CONTAINER" ]]; then
    echo "🐳 Docker PostgreSQL container detected: $DB_CONTAINER"
    echo "Copying SQL files into container..."

    docker cp "$CREATE_SQL" $DB_CONTAINER:/create_tables.sql
    docker cp "$INSERT_SQL" $DB_CONTAINER:/insert_default_users.sql

    echo "📥 Running create_tables.sql..."
    docker exec -it $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -f /create_tables.sql

    echo "📥 Running insert_default_users.sql..."
    docker exec -it $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -f /insert_default_users.sql

    echo "=============================================="
    echo "   ✔ Database seeding completed (Docker)       "
    echo "=============================================="
    exit 0
fi

# If Postgres is local (psql)
echo "🐘 No Docker container detected — using local PostgreSQL"

command -v psql >/dev/null 2>&1 || {
    echo "❌ ERROR: psql command not found. Install PostgreSQL or ensure it's in PATH."
    exit 1
}

echo "📥 Running create_tables.sql..."
psql -U $DB_USER -d $DB_NAME -f "$CREATE_SQL"

echo "📥 Running insert_default_users.sql..."
psql -U $DB_USER -d $DB_NAME -f "$INSERT_SQL"

echo "=============================================="
echo "   ✔ Database seeding completed (Local)        "
echo "=============================================="
        