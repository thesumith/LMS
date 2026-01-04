-- ============================================================================
-- Multi-Tenant LMS SaaS - Content RLS Policies
-- ============================================================================
-- This migration implements Row Level Security for Modules and Lessons
-- All policies enforce strict tenant isolation and role-based access
-- ============================================================================

-- Enable RLS on all content tables
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- MODULES TABLE POLICIES
-- ============================================================================

-- SELECT: Institute Admin sees all, Teachers see modules for assigned courses, Students see modules for enrolled batches
CREATE POLICY "modules_select"
ON modules
FOR SELECT
USING (
    -- SUPER_ADMIN can see all active modules
    (is_super_admin() AND deleted_at IS NULL)
    OR
    -- INSTITUTE_ADMIN can see all modules in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id() 
        AND deleted_at IS NULL)
    OR
    -- TEACHER can see modules for courses they are assigned to
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND course_id IN (
            SELECT DISTINCT b.course_id
            FROM batches b
            INNER JOIN batch_teachers bt ON b.id = bt.batch_id
            WHERE bt.teacher_id = auth.uid()
                AND b.deleted_at IS NULL
                AND bt.deleted_at IS NULL
        )
        AND deleted_at IS NULL)
    OR
    -- STUDENT can see modules for courses in batches they are enrolled in
    (has_role('STUDENT') 
        AND institute_id = get_user_institute_id()
        AND course_id IN (
            SELECT DISTINCT b.course_id
            FROM batches b
            INNER JOIN batch_students bs ON b.id = bs.batch_id
            WHERE bs.student_id = auth.uid()
                AND bs.status = 'active'
                AND b.deleted_at IS NULL
                AND bs.deleted_at IS NULL
        )
        AND deleted_at IS NULL)
);

-- INSERT: Institute Admin and Teachers can create modules
CREATE POLICY "modules_insert"
ON modules
FOR INSERT
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id()
        AND course_id IN (
            SELECT id 
            FROM courses 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        ))
    OR
    -- TEACHER can create modules for courses they are assigned to
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND course_id IN (
            SELECT DISTINCT b.course_id
            FROM batches b
            INNER JOIN batch_teachers bt ON b.id = bt.batch_id
            WHERE bt.teacher_id = auth.uid()
                AND b.deleted_at IS NULL
                AND bt.deleted_at IS NULL
        ))
);

-- UPDATE: Institute Admin and Teachers can update modules
CREATE POLICY "modules_update"
ON modules
FOR UPDATE
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- TEACHER can update modules for courses they are assigned to
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND course_id IN (
            SELECT DISTINCT b.course_id
            FROM batches b
            INNER JOIN batch_teachers bt ON b.id = bt.batch_id
            WHERE bt.teacher_id = auth.uid()
                AND b.deleted_at IS NULL
                AND bt.deleted_at IS NULL
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
        AND course_id IN (
            SELECT DISTINCT b.course_id
            FROM batches b
            INNER JOIN batch_teachers bt ON b.id = bt.batch_id
            WHERE bt.teacher_id = auth.uid()
                AND b.deleted_at IS NULL
                AND bt.deleted_at IS NULL
        ))
);

-- DELETE: Soft delete only, Institute Admin and Teachers
CREATE POLICY "modules_delete"
ON modules
FOR UPDATE -- Using UPDATE because we soft delete via deleted_at
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- TEACHER can soft delete modules for courses they are assigned to
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND course_id IN (
            SELECT DISTINCT b.course_id
            FROM batches b
            INNER JOIN batch_teachers bt ON b.id = bt.batch_id
            WHERE bt.teacher_id = auth.uid()
                AND b.deleted_at IS NULL
                AND bt.deleted_at IS NULL
        ))
)
WITH CHECK (
    (is_super_admin() OR has_role('INSTITUTE_ADMIN') OR has_role('TEACHER'))
    AND deleted_at IS NOT NULL
);

-- ============================================================================
-- LESSONS TABLE POLICIES
-- ============================================================================

-- SELECT: Institute Admin sees all, Teachers see lessons for assigned courses, Students see lessons for enrolled batches
CREATE POLICY "lessons_select"
ON lessons
FOR SELECT
USING (
    -- SUPER_ADMIN can see all active lessons
    (is_super_admin() AND deleted_at IS NULL)
    OR
    -- INSTITUTE_ADMIN can see all lessons in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id() 
        AND deleted_at IS NULL)
    OR
    -- TEACHER can see lessons for courses they are assigned to
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND course_id IN (
            SELECT DISTINCT b.course_id
            FROM batches b
            INNER JOIN batch_teachers bt ON b.id = bt.batch_id
            WHERE bt.teacher_id = auth.uid()
                AND b.deleted_at IS NULL
                AND bt.deleted_at IS NULL
        )
        AND deleted_at IS NULL)
    OR
    -- STUDENT can see lessons for courses in batches they are enrolled in
    (has_role('STUDENT') 
        AND institute_id = get_user_institute_id()
        AND course_id IN (
            SELECT DISTINCT b.course_id
            FROM batches b
            INNER JOIN batch_students bs ON b.id = bs.batch_id
            WHERE bs.student_id = auth.uid()
                AND bs.status = 'active'
                AND b.deleted_at IS NULL
                AND bs.deleted_at IS NULL
        )
        AND deleted_at IS NULL)
);

-- INSERT: Institute Admin and Teachers can create lessons
CREATE POLICY "lessons_insert"
ON lessons
FOR INSERT
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id()
        AND course_id IN (
            SELECT id 
            FROM courses 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        )
        AND module_id IN (
            SELECT id 
            FROM modules 
            WHERE course_id = course_id
                AND institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        ))
    OR
    -- TEACHER can create lessons for courses they are assigned to
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND course_id IN (
            SELECT DISTINCT b.course_id
            FROM batches b
            INNER JOIN batch_teachers bt ON b.id = bt.batch_id
            WHERE bt.teacher_id = auth.uid()
                AND b.deleted_at IS NULL
                AND bt.deleted_at IS NULL
        )
        AND module_id IN (
            SELECT id 
            FROM modules 
            WHERE course_id = course_id
                AND institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        ))
);

-- UPDATE: Institute Admin and Teachers can update lessons
CREATE POLICY "lessons_update"
ON lessons
FOR UPDATE
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- TEACHER can update lessons for courses they are assigned to
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND course_id IN (
            SELECT DISTINCT b.course_id
            FROM batches b
            INNER JOIN batch_teachers bt ON b.id = bt.batch_id
            WHERE bt.teacher_id = auth.uid()
                AND b.deleted_at IS NULL
                AND bt.deleted_at IS NULL
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
        AND course_id IN (
            SELECT DISTINCT b.course_id
            FROM batches b
            INNER JOIN batch_teachers bt ON b.id = bt.batch_id
            WHERE bt.teacher_id = auth.uid()
                AND b.deleted_at IS NULL
                AND bt.deleted_at IS NULL
        ))
);

-- DELETE: Soft delete only, Institute Admin and Teachers
CREATE POLICY "lessons_delete"
ON lessons
FOR UPDATE -- Using UPDATE because we soft delete via deleted_at
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- TEACHER can soft delete lessons for courses they are assigned to
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND course_id IN (
            SELECT DISTINCT b.course_id
            FROM batches b
            INNER JOIN batch_teachers bt ON b.id = bt.batch_id
            WHERE bt.teacher_id = auth.uid()
                AND b.deleted_at IS NULL
                AND bt.deleted_at IS NULL
        ))
)
WITH CHECK (
    (is_super_admin() OR has_role('INSTITUTE_ADMIN') OR has_role('TEACHER'))
    AND deleted_at IS NOT NULL
);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON POLICY "modules_select" ON modules IS 'Institute Admin sees all. Teachers see modules for assigned courses. Students see modules for enrolled batches.';
COMMENT ON POLICY "lessons_select" ON lessons IS 'Institute Admin sees all. Teachers see lessons for assigned courses. Students see lessons for enrolled batches.';

