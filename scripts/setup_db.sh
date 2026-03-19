#!/usr/bin/env bash
# Run once to create the editorial PostgreSQL user and database.
# Requires sudo (will prompt for your password).
set -e
sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'editorial') THEN
    CREATE USER editorial WITH PASSWORD 'editorial';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE editorial_pipeline OWNER editorial'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'editorial_pipeline')
\gexec

GRANT ALL PRIVILEGES ON DATABASE editorial_pipeline TO editorial;
SQL
echo "Done. DB user and database are ready."
