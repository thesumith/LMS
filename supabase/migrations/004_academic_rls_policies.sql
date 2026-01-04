-- ============================================================================
-- Multi-Tenant LMS SaaS - Academic Structure RLS Policies
-- ============================================================================
-- This migration implements Row Level Security for Courses, Batches, and Enrollments
-- All policies enforce strict tenant isolation and role-based access
-- ============================================================================

-- Enable RLS on all academic tables
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_students ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COURSES TABLE POLICIES
-- ============================================================================

-- SELECT: Institute Admin sees all courses in their institute, SUPER_ADMIN sees all
CREATE POLICY "courses_select"
ON courses
FOR SELECT
USING (
    -- SUPER_ADMIN can see all active courses
    (is_super_admin() AND deleted_at IS NULL)
    OR
    -- INSTITUTE_ADMIN can see all courses in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id() 
        AND deleted_at IS NULL)
);

-- INSERT: Only Institute Admin can create courses
CREATE POLICY "courses_insert_admin"
ON courses
FOR INSERT
WITH CHECK (
    -- SUPER_ADMIN can create courses in any institute
    is_super_admin()
    OR
    -- INSTITUTE_ADMIN can create courses in their own institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
);

-- UPDATE: Only Institute Admin can update courses
CREATE POLICY "courses_update_admin"
ON courses
FOR UPDATE
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
)
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
);

-- DELETE: Soft delete only, Institute Admin only
CREATE POLICY "courses_delete_admin"
ON courses
FOR UPDATE -- Using UPDATE because we soft delete via deleted_at
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
)
WITH CHECK (
    (is_super_admin() OR has_role('INSTITUTE_ADMIN'))
    AND deleted_at IS NOT NULL
);

-- ============================================================================
-- BATCHES TABLE POLICIES
-- ============================================================================

-- SELECT: Institute Admin sees all batches, Teachers see assigned batches, Students see enrolled batches
CREATE POLICY "batches_select"
ON batches
FOR SELECT
USING (
    -- SUPER_ADMIN can see all active batches
    (is_super_admin() AND deleted_at IS NULL)
    OR
    -- INSTITUTE_ADMIN can see all batches in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id() 
        AND deleted_at IS NULL)
    OR
    -- TEACHER can see batches they are assigned to
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        )
        AND deleted_at IS NULL)
    OR
    -- STUDENT can see batches they are enrolled in
    (has_role('STUDENT') 
        AND institute_id = get_user_institute_id()
        AND id IN (
            SELECT batch_id 
            FROM batch_students 
            WHERE student_id = auth.uid()
                AND deleted_at IS NULL
        )
        AND deleted_at IS NULL)
);

-- INSERT: Only Institute Admin can create batches
CREATE POLICY "batches_insert_admin"
ON batches
FOR INSERT
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id()
        -- Ensure course belongs to same institute
        AND course_id IN (
            SELECT id 
            FROM courses 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        ))
);

-- UPDATE: Only Institute Admin can update batches
CREATE POLICY "batches_update_admin"
ON batches
FOR UPDATE
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
)
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
);

-- DELETE: Soft delete only, Institute Admin only
CREATE POLICY "batches_delete_admin"
ON batches
FOR UPDATE -- Using UPDATE because we soft delete via deleted_at
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
)
WITH CHECK (
    (is_super_admin() OR has_role('INSTITUTE_ADMIN'))
    AND deleted_at IS NOT NULL
);

-- ============================================================================
-- BATCH_TEACHERS TABLE POLICIES
-- ============================================================================

-- SELECT: Institute Admin sees all, Teachers see their own assignments
CREATE POLICY "batch_teachers_select"
ON batch_teachers
FOR SELECT
USING (
    -- SUPER_ADMIN can see all active assignments
    (is_super_admin() AND deleted_at IS NULL)
    OR
    -- INSTITUTE_ADMIN can see all assignments in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id() 
        AND deleted_at IS NULL)
    OR
    -- TEACHER can see their own assignments
    (has_role('TEACHER') 
        AND teacher_id = auth.uid()
        AND deleted_at IS NULL)
);

-- INSERT: Only Institute Admin can assign teachers to batches
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
            JOIN roles r ON ur.role_id = r.id
            WHERE p.institute_id = get_user_institute_id()
                AND r.name = 'TEACHER'
                AND p.deleted_at IS NULL
                AND ur.deleted_at IS NULL
        ))
);

-- UPDATE: Only Institute Admin can update teacher assignments
CREATE POLICY "batch_teachers_update_admin"
ON batch_teachers
FOR UPDATE
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
)
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
);

-- DELETE: Soft delete only, Institute Admin only
CREATE POLICY "batch_teachers_delete_admin"
ON batch_teachers
FOR UPDATE -- Using UPDATE because we soft delete via deleted_at
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
)
WITH CHECK (
    (is_super_admin() OR has_role('INSTITUTE_ADMIN'))
    AND deleted_at IS NOT NULL
);

-- ============================================================================
-- BATCH_STUDENTS TABLE POLICIES (Enrollments)
-- ============================================================================

-- SELECT: Institute Admin sees all, Teachers see students in their batches, Students see their own enrollments
CREATE POLICY "batch_students_select"
ON batch_students
FOR SELECT
USING (
    -- SUPER_ADMIN can see all active enrollments
    (is_super_admin() AND deleted_at IS NULL)
    OR
    -- INSTITUTE_ADMIN can see all enrollments in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id() 
        AND deleted_at IS NULL)
    OR
    -- TEACHER can see students in batches they teach
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        )
        AND deleted_at IS NULL)
    OR
    -- STUDENT can see their own enrollments
    (has_role('STUDENT') 
        AND student_id = auth.uid()
        AND deleted_at IS NULL)
);

-- INSERT: Only Institute Admin can enroll students
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
            JOIN roles r ON ur.role_id = r.id
            WHERE p.institute_id = get_user_institute_id()
                AND r.name = 'STUDENT'
                AND p.deleted_at IS NULL
                AND ur.deleted_at IS NULL
        ))
);

-- UPDATE: Institute Admin can update enrollments, Teachers can update status
CREATE POLICY "batch_students_update"
ON batch_students
FOR UPDATE
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- TEACHER can update enrollment status for students in their batches
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        ))
)
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        ))
);

-- DELETE: Soft delete only, Institute Admin only
CREATE POLICY "batch_students_delete_admin"
ON batch_students
FOR UPDATE -- Using UPDATE because we soft delete via deleted_at
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
)
WITH CHECK (
    (is_super_admin() OR has_role('INSTITUTE_ADMIN'))
    AND deleted_at IS NOT NULL
);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON POLICY "courses_select" ON courses IS 'Institute Admin sees all courses. SUPER_ADMIN sees all.';
COMMENT ON POLICY "batches_select" ON batches IS 'Institute Admin sees all batches. Teachers see assigned batches. Students see enrolled batches.';
COMMENT ON POLICY "batch_teachers_select" ON batch_teachers IS 'Institute Admin sees all. Teachers see their own assignments.';
COMMENT ON POLICY "batch_students_select" ON batch_students IS 'Institute Admin sees all. Teachers see students in their batches. Students see their own enrollments.';

