-- ============================================================================
-- Multi-Tenant LMS SaaS - Fix RLS role helper functions (no `roles` table)
-- ============================================================================
-- Some environments have already dropped the `roles` table (see 020_simplify_roles.sql)
-- but still have older helper functions (from 002_rls_policies.sql) that reference it.
-- This breaks *any* policy that calls `is_super_admin()` / `has_role(...)` with:
--   relation "roles" does not exist
--
-- This migration redefines the helper functions to use `user_roles.role_name` only.
-- ============================================================================

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE p.id = auth.uid()
            AND ur.role_name = 'SUPER_ADMIN'
            AND ur.deleted_at IS NULL
            AND p.deleted_at IS NULL
    );
END;
$$;

CREATE OR REPLACE FUNCTION has_role(role_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE p.id = auth.uid()
            AND ur.role_name = $1
            AND ur.deleted_at IS NULL
            AND p.deleted_at IS NULL
            AND (
                -- SUPER_ADMIN role doesn't require institute_id match
                ur.role_name = 'SUPER_ADMIN'
                OR ur.institute_id = get_user_institute_id()
            )
    );
END;
$$;

COMMENT ON FUNCTION is_super_admin() IS 'Returns true if current user has SUPER_ADMIN role (role_name based; no roles table).';
COMMENT ON FUNCTION has_role(TEXT) IS 'Returns true if current user has the specified role in their institute (role_name based; no roles table).';


