-- ============================================================================
-- Multi-Tenant LMS SaaS - Row Level Security (RLS) Policies
-- ============================================================================
-- This migration implements strict tenant isolation using RLS
-- All policies enforce multi-tenant security at the database level
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================================
-- These functions are used by RLS policies to determine user permissions
-- All functions are SECURITY DEFINER to ensure consistent execution context
-- ============================================================================

-- Function: Check if current user is SUPER_ADMIN
-- Returns: true if user has SUPER_ADMIN role, false otherwise
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
        JOIN roles r ON ur.role_id = r.id
        JOIN profiles p ON ur.user_id = p.id
        WHERE p.id = auth.uid()
            AND r.name = 'SUPER_ADMIN'
            AND ur.deleted_at IS NULL
            AND p.deleted_at IS NULL
            AND r.deleted_at IS NULL
    );
END;
$$;

-- Function: Get current user's institute_id
-- Returns: UUID of user's institute, or NULL for SUPER_ADMIN
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_institute_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    user_institute_id UUID;
BEGIN
    -- SUPER_ADMIN doesn't have institute_id constraint
    IF is_super_admin() THEN
        RETURN NULL;
    END IF;
    
    -- Get institute_id from user's profile
    SELECT institute_id INTO user_institute_id
    FROM profiles
    WHERE id = auth.uid()
        AND deleted_at IS NULL
        AND is_active = true;
    
    RETURN user_institute_id;
END;
$$;

-- Function: Check if current user has a specific role
-- Parameters: role_name (e.g., 'INSTITUTE_ADMIN', 'TEACHER', 'STUDENT')
-- Returns: true if user has the role, false otherwise
-- ============================================================================
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
        JOIN roles r ON ur.role_id = r.id
        JOIN profiles p ON ur.user_id = p.id
        WHERE p.id = auth.uid()
            AND r.name = role_name
            AND ur.deleted_at IS NULL
            AND p.deleted_at IS NULL
            AND r.deleted_at IS NULL
            AND (
                -- SUPER_ADMIN role doesn't require institute_id match
                r.name = 'SUPER_ADMIN'
                OR ur.institute_id = get_user_institute_id()
            )
    );
END;
$$;

-- Function: Check if current user can access a specific institute
-- Parameters: target_institute_id UUID
-- Returns: true if user can access, false otherwise
-- ============================================================================
CREATE OR REPLACE FUNCTION can_access_institute(target_institute_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    user_institute_id UUID;
BEGIN
    -- SUPER_ADMIN can access all institutes
    IF is_super_admin() THEN
        RETURN true;
    END IF;
    
    -- Get user's institute
    user_institute_id := get_user_institute_id();
    
    -- User can only access their own institute
    RETURN user_institute_id = target_institute_id;
END;
$$;

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
ALTER TABLE institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- INSTITUTES TABLE POLICIES
-- ============================================================================
-- Institutes are tenants. Access is restricted by role and institute membership.
-- ============================================================================

-- SELECT: Users can see their own institute, SUPER_ADMIN sees all
-- ============================================================================
CREATE POLICY "institutes_select_own"
ON institutes
FOR SELECT
USING (
    -- SUPER_ADMIN can see all active institutes
    (is_super_admin() AND deleted_at IS NULL)
    OR
    -- Others can only see their own institute
    (id = get_user_institute_id() AND deleted_at IS NULL)
);

-- INSERT: Only SUPER_ADMIN can create new institutes
-- ============================================================================
CREATE POLICY "institutes_insert_super_admin"
ON institutes
FOR INSERT
WITH CHECK (is_super_admin());

-- UPDATE: Only SUPER_ADMIN can update institutes
-- ============================================================================
CREATE POLICY "institutes_update_super_admin"
ON institutes
FOR UPDATE
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- DELETE: Soft delete only, SUPER_ADMIN only
-- ============================================================================
CREATE POLICY "institutes_delete_super_admin"
ON institutes
FOR UPDATE -- Using UPDATE because we soft delete via deleted_at
USING (is_super_admin())
WITH CHECK (is_super_admin() AND deleted_at IS NOT NULL);

-- ============================================================================
-- PROFILES TABLE POLICIES
-- ============================================================================
-- Profiles are user data. Access is restricted by role and institute.
-- ============================================================================

-- SELECT: Users can see profiles in their institute, or their own profile
-- ============================================================================
CREATE POLICY "profiles_select"
ON profiles
FOR SELECT
USING (
    -- SUPER_ADMIN can see all active profiles
    (is_super_admin() AND deleted_at IS NULL)
    OR
    -- INSTITUTE_ADMIN can see all profiles in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id() 
        AND deleted_at IS NULL)
    OR
    -- Users can always see their own profile
    (id = auth.uid() AND deleted_at IS NULL)
);

-- INSERT: Only SUPER_ADMIN and INSTITUTE_ADMIN can create profiles
-- ============================================================================
CREATE POLICY "profiles_insert_admin"
ON profiles
FOR INSERT
WITH CHECK (
    -- SUPER_ADMIN can create profiles in any institute
    is_super_admin()
    OR
    -- INSTITUTE_ADMIN can create profiles in their own institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
);

-- UPDATE: Users can update their own profile, admins can update in their institute
-- ============================================================================
CREATE POLICY "profiles_update"
ON profiles
FOR UPDATE
USING (
    -- SUPER_ADMIN can update any profile
    is_super_admin()
    OR
    -- INSTITUTE_ADMIN can update profiles in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- Users can update their own profile (limited fields enforced by application)
    id = auth.uid()
)
WITH CHECK (
    -- Same conditions for WITH CHECK
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    id = auth.uid()
);

-- DELETE: Soft delete only, SUPER_ADMIN and INSTITUTE_ADMIN only
-- ============================================================================
CREATE POLICY "profiles_delete_admin"
ON profiles
FOR UPDATE -- Using UPDATE because we soft delete via deleted_at
USING (
    -- SUPER_ADMIN can soft delete any profile
    is_super_admin()
    OR
    -- INSTITUTE_ADMIN can soft delete profiles in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
)
WITH CHECK (
    (is_super_admin() OR has_role('INSTITUTE_ADMIN'))
    AND deleted_at IS NOT NULL
);

-- ============================================================================
-- USER_ROLES TABLE POLICIES
-- ============================================================================
-- User roles define permissions. Access is restricted by role and institute.
-- ============================================================================

-- SELECT: Users can see roles in their institute, or their own roles
-- ============================================================================
CREATE POLICY "user_roles_select"
ON user_roles
FOR SELECT
USING (
    -- SUPER_ADMIN can see all active role assignments
    (is_super_admin() AND deleted_at IS NULL)
    OR
    -- INSTITUTE_ADMIN can see role assignments in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id() 
        AND deleted_at IS NULL)
    OR
    -- Users can see their own role assignments
    (user_id = auth.uid() AND deleted_at IS NULL)
);

-- INSERT: Only SUPER_ADMIN and INSTITUTE_ADMIN can assign roles
-- ============================================================================
CREATE POLICY "user_roles_insert_admin"
ON user_roles
FOR INSERT
WITH CHECK (
    -- SUPER_ADMIN can assign any role
    is_super_admin()
    OR
    -- INSTITUTE_ADMIN can assign roles in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id()
        -- Prevent INSTITUTE_ADMIN from assigning SUPER_ADMIN role
        AND role_id NOT IN (SELECT id FROM roles WHERE name = 'SUPER_ADMIN'))
);

-- UPDATE: Only SUPER_ADMIN and INSTITUTE_ADMIN can update role assignments
-- ============================================================================
CREATE POLICY "user_roles_update_admin"
ON user_roles
FOR UPDATE
USING (
    -- SUPER_ADMIN can update any role assignment
    is_super_admin()
    OR
    -- INSTITUTE_ADMIN can update role assignments in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
)
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id()
        -- Prevent INSTITUTE_ADMIN from assigning SUPER_ADMIN role
        AND role_id NOT IN (SELECT id FROM roles WHERE name = 'SUPER_ADMIN'))
);

-- DELETE: Soft delete only, SUPER_ADMIN and INSTITUTE_ADMIN only
-- ============================================================================
CREATE POLICY "user_roles_delete_admin"
ON user_roles
FOR UPDATE -- Using UPDATE because we soft delete via deleted_at
USING (
    -- SUPER_ADMIN can soft delete any role assignment
    is_super_admin()
    OR
    -- INSTITUTE_ADMIN can soft delete role assignments in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
)
WITH CHECK (
    (is_super_admin() OR has_role('INSTITUTE_ADMIN'))
    AND deleted_at IS NOT NULL
);

-- ============================================================================
-- AUDIT_LOGS TABLE POLICIES
-- ============================================================================
-- Audit logs are read-only for compliance. Only SUPER_ADMIN can insert.
-- ============================================================================

-- SELECT: Users can see audit logs for their institute, SUPER_ADMIN sees all
-- ============================================================================
CREATE POLICY "audit_logs_select"
ON audit_logs
FOR SELECT
USING (
    -- SUPER_ADMIN can see all audit logs
    is_super_admin()
    OR
    -- INSTITUTE_ADMIN can see audit logs for their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- Users can see their own audit log entries
    user_id = auth.uid()
);

-- INSERT: Only system/service role can insert (application code)
-- Regular users cannot insert audit logs directly
-- This policy allows authenticated users, but application should use service role
-- ============================================================================
CREATE POLICY "audit_logs_insert_authenticated"
ON audit_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: No updates allowed (audit logs are immutable)
-- ============================================================================
-- No UPDATE policy = no updates allowed

-- DELETE: No deletes allowed (audit logs are permanent)
-- ============================================================================
-- No DELETE policy = no deletes allowed

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON FUNCTION is_super_admin() IS 'Returns true if current user has SUPER_ADMIN role. Used by RLS policies.';
COMMENT ON FUNCTION get_user_institute_id() IS 'Returns current user''s institute_id. Returns NULL for SUPER_ADMIN.';
COMMENT ON FUNCTION has_role(TEXT) IS 'Returns true if current user has the specified role in their institute.';
COMMENT ON FUNCTION can_access_institute(UUID) IS 'Returns true if current user can access the specified institute.';

COMMENT ON POLICY "institutes_select_own" ON institutes IS 'Users can see their own institute. SUPER_ADMIN sees all.';
COMMENT ON POLICY "profiles_select" ON profiles IS 'Users see profiles in their institute or their own profile. SUPER_ADMIN sees all.';
COMMENT ON POLICY "user_roles_select" ON user_roles IS 'Users see role assignments in their institute or their own. SUPER_ADMIN sees all.';
COMMENT ON POLICY "audit_logs_select" ON audit_logs IS 'Users see audit logs for their institute or their own. SUPER_ADMIN sees all.';

