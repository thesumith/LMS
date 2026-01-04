-- ============================================================================
-- Multi-Tenant LMS SaaS - Service Role Grants
-- ============================================================================
-- Supabase "service_role" should be able to bypass RLS AND have SQL privileges.
-- If privileges are missing, PostgREST will return "permission denied" even with
-- a service role JWT. This migration ensures service_role can fully administer
-- the schema, which is required for server-side admin operations and scripts.
-- ============================================================================

-- Ensure the service_role can use the public schema
GRANT USAGE ON SCHEMA public TO service_role;

-- Ensure the service_role has full privileges on everything in public schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Ensure future objects also grant privileges to service_role
-- Note: ALTER DEFAULT PRIVILEGES affects objects created by the current role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO service_role;


