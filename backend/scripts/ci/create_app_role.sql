-- The database role the integration tests connect as.
--
-- It stands in for the application's own role: it can read and write rows and
-- use sequences, and nothing else. It is not a superuser, cannot bypass
-- row-level security, cannot create databases or roles, owns nothing and
-- cannot change the schema. A test that passes as this role does not depend on
-- superuser powers that production would not give the application.
--
-- Run it as the migration user AFTER `prisma migrate deploy`, so the tables
-- exist when the rights are granted:
--
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -v app_password="$APP_DB_PASSWORD" \
--        -f scripts/ci/create_app_role.sql
--
-- Safe to run again: the role is created once and the rights are re-applied.

SELECT format(
  'CREATE ROLE bnpl_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION',
  :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bnpl_app')
\gexec

-- Keep the password in step with the secret when the role already exists.
SELECT format('ALTER ROLE bnpl_app PASSWORD %L', :'app_password')
\gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO bnpl_app', current_database())
\gexec

GRANT USAGE ON SCHEMA public TO bnpl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bnpl_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bnpl_app;
