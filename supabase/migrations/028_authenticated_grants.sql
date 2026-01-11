-- ============================================================================
-- Multi-Tenant LMS SaaS - Authenticated Role Grants
-- ============================================================================
-- RLS policies do NOT override SQL privileges.
-- If `authenticated` lacks SELECT/INSERT/etc privileges, PostgREST will return
-- "permission denied for table ..." before evaluating RLS.
--
-- This migration grants the `authenticated` role the required schema/table
-- privileges. RLS continues to enforce tenant isolation and authorization.
-- ============================================================================

-- Allow authenticated role to use the public schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant privileges on existing objects
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Ensure future objects also grant privileges to authenticated
-- Note: ALTER DEFAULT PRIVILEGES affects objects created by the current role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;


