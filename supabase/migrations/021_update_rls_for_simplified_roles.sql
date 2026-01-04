-- ============================================================================
-- Migration: Update RLS Policies for Simplified Roles
-- ============================================================================
-- This migration recreates RLS policies to use role_name instead of role_id
-- after simplifying the roles/user_roles tables
-- ============================================================================

-- Update user_roles INSERT policy to use role_name instead of role_id
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
        AND role_name != 'SUPER_ADMIN')
);

-- Update user_roles UPDATE policy to use role_name instead of role_id
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
        AND role_name != 'SUPER_ADMIN')
);

-- Update batch_teachers INSERT policy to use role_name instead of role_id
CREATE POLICY "batch_teachers_insert_admin"
ON batch_teachers
FOR INSERT
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id()
        -- Ensure batch belongs to same institute
        AND batch_id IN (
            SELECT id 
            FROM batches 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        )
        -- Ensure teacher belongs to same institute and has TEACHER role
        AND teacher_id IN (
            SELECT p.id 
            FROM profiles p
            JOIN user_roles ur ON p.id = ur.user_id
            WHERE p.institute_id = get_user_institute_id()
                AND ur.role_name = 'TEACHER'
                AND p.deleted_at IS NULL
                AND ur.deleted_at IS NULL
        ))
);

-- Update batch_students INSERT policy to use role_name instead of role_id
CREATE POLICY "batch_students_insert_admin"
ON batch_students
FOR INSERT
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id()
        -- Ensure batch belongs to same institute
        AND batch_id IN (
            SELECT id 
            FROM batches 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        )
        -- Ensure student belongs to same institute and has STUDENT role
        AND student_id IN (
            SELECT p.id 
            FROM profiles p
            JOIN user_roles ur ON p.id = ur.user_id
            WHERE p.institute_id = get_user_institute_id()
                AND ur.role_name = 'STUDENT'
                AND p.deleted_at IS NULL
                AND ur.deleted_at IS NULL
        ))
);

