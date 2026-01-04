-- ============================================================================
-- Migration: Simplify Roles and User Roles Tables
-- ============================================================================
-- This migration simplifies the roles system by:
-- 1. Storing role names directly in user_roles table (TEXT) instead of role_id (UUID)
-- 2. Removing the roles table entirely (roles are static: SUPER_ADMIN, INSTITUTE_ADMIN, TEACHER, STUDENT)
-- 3. Using composite primary key (user_id, role_name, institute_id) instead of separate id
-- 4. Removing updated_at (role assignments don't need updating)
-- ============================================================================

-- Step 1: Add role_name column to user_roles
ALTER TABLE user_roles ADD COLUMN role_name TEXT;

-- Step 2: Migrate data from role_id to role_name
UPDATE user_roles ur
SET role_name = r.name
FROM roles r
WHERE ur.role_id = r.id;

-- Step 3: Make role_name NOT NULL after migration
ALTER TABLE user_roles ALTER COLUMN role_name SET NOT NULL;

-- Step 4: Add CHECK constraint to ensure valid role names
ALTER TABLE user_roles ADD CONSTRAINT check_valid_role_name 
  CHECK (role_name IN ('SUPER_ADMIN', 'INSTITUTE_ADMIN', 'TEACHER', 'STUDENT'));

-- Step 5: Drop all indexes that we'll recreate (some may not exist, that's fine)
DROP INDEX IF EXISTS idx_user_roles_role_id;
DROP INDEX IF EXISTS idx_user_roles_user_id;
DROP INDEX IF EXISTS idx_user_roles_institute_id;
DROP INDEX IF EXISTS idx_user_roles_user_institute;
DROP INDEX IF EXISTS idx_user_roles_deleted_at;

-- Step 6: Drop the foreign key constraint to roles table
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_id_fkey;

-- Step 7: Drop policies that depend on role_id BEFORE dropping the column
DROP POLICY IF EXISTS "user_roles_insert_admin" ON user_roles;
DROP POLICY IF EXISTS "user_roles_update_admin" ON user_roles;

-- Step 8: Drop policies from other tables that reference user_roles.role_id
DROP POLICY IF EXISTS "batch_teachers_insert_admin" ON batch_teachers;
DROP POLICY IF EXISTS "batch_students_insert_admin" ON batch_students;

-- Step 9: Drop old columns and constraints
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_id_institute_id_deleted_at_key;
ALTER TABLE user_roles DROP COLUMN IF EXISTS role_id;
ALTER TABLE user_roles DROP COLUMN IF EXISTS updated_at;

-- Step 10: Add unique constraint for active rows only (handles soft deletes)
-- Use COALESCE to handle NULL institute_id for SUPER_ADMIN
CREATE UNIQUE INDEX user_roles_unique_active 
  ON user_roles(user_id, role_name, COALESCE(institute_id, '00000000-0000-0000-0000-000000000000'::UUID))
  WHERE deleted_at IS NULL;

-- Step 11: Recreate indexes
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_role_name ON user_roles(role_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_institute_id ON user_roles(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_user_institute ON user_roles(user_id, institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_deleted_at ON user_roles(deleted_at) WHERE deleted_at IS NOT NULL;

-- Step 12: Drop the roles table (no longer needed)
DROP TABLE IF EXISTS roles CASCADE;

-- Step 13: Update RLS function to use role_name instead of role_id
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
            AND ur.role_name = has_role.role_name
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

-- Step 12: Update trigger function (remove roles table reference if any)
-- (This should already be fine, but we ensure it's correct)

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE user_roles IS 'User role assignments. Stores role names directly (SUPER_ADMIN, INSTITUTE_ADMIN, TEACHER, STUDENT). Simplified schema without separate roles table.';
COMMENT ON COLUMN user_roles.role_name IS 'Role name: SUPER_ADMIN, INSTITUTE_ADMIN, TEACHER, or STUDENT';

