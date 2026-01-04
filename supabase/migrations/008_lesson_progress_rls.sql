-- ============================================================================
-- Multi-Tenant LMS SaaS - Lesson Progress RLS Policies
-- ============================================================================
-- This migration implements Row Level Security for lesson_progress
-- All policies enforce strict tenant isolation and role-based access
-- ============================================================================

-- Enable RLS on lesson_progress table
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- LESSON_PROGRESS TABLE POLICIES
-- ============================================================================

-- SELECT: Students see their own progress, Teachers see progress of students in their batches, Admin sees all
CREATE POLICY "lesson_progress_select"
ON lesson_progress
FOR SELECT
USING (
    -- SUPER_ADMIN can see all active progress
    (is_super_admin() AND deleted_at IS NULL)
    OR
    -- INSTITUTE_ADMIN can see all progress in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id() 
        AND deleted_at IS NULL)
    OR
    -- TEACHER can see progress of students in batches they teach
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
    -- STUDENT can see their own progress only
    (has_role('STUDENT') 
        AND student_id = auth.uid()
        AND deleted_at IS NULL)
);

-- INSERT: Students can create their own progress records
CREATE POLICY "lesson_progress_insert_student"
ON lesson_progress
FOR INSERT
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id()
        -- Ensure student belongs to institute
        AND student_id IN (
            SELECT id 
            FROM profiles 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        )
        -- Ensure lesson belongs to institute
        AND lesson_id IN (
            SELECT id 
            FROM lessons 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        )
        -- Ensure batch belongs to institute
        AND batch_id IN (
            SELECT id 
            FROM batches 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        ))
    OR
    -- STUDENT can create their own progress records
    (has_role('STUDENT') 
        AND student_id = auth.uid()
        AND institute_id = get_user_institute_id()
        -- Ensure student is enrolled in the batch
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_students 
            WHERE student_id = auth.uid()
                AND status = 'active'
                AND deleted_at IS NULL
        )
        -- Ensure lesson belongs to a module in the course
        AND lesson_id IN (
            SELECT l.id 
            FROM lessons l
            INNER JOIN modules m ON l.module_id = m.id
            INNER JOIN batches b ON m.course_id = b.course_id
            WHERE b.id = batch_id
                AND l.deleted_at IS NULL
                AND m.deleted_at IS NULL
        ))
);

-- UPDATE: Students can update their own progress (but not if completed)
CREATE POLICY "lesson_progress_update_student"
ON lesson_progress
FOR UPDATE
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- STUDENT can update their own progress (trigger prevents updating if completed)
    (has_role('STUDENT') 
        AND student_id = auth.uid()
        AND institute_id = get_user_institute_id())
)
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- STUDENT can update their own progress
    (has_role('STUDENT') 
        AND student_id = auth.uid()
        AND institute_id = get_user_institute_id()
        -- Prevent updating completed_at directly (trigger will handle it)
        AND (
            -- Can update if not completed
            completed_at IS NULL
            OR
            -- Or if completed_at is being set for the first time
            (completed_at IS NOT NULL AND OLD.completed_at IS NULL)
        ))
);

-- DELETE: Soft delete only, Students can delete their own, Admin can delete any
CREATE POLICY "lesson_progress_delete"
ON lesson_progress
FOR UPDATE -- Using UPDATE because we soft delete via deleted_at
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- STUDENT can soft delete their own progress
    (has_role('STUDENT') 
        AND student_id = auth.uid()
        AND institute_id = get_user_institute_id())
)
WITH CHECK (
    (is_super_admin() OR has_role('INSTITUTE_ADMIN') OR has_role('STUDENT'))
    AND deleted_at IS NOT NULL
);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON POLICY "lesson_progress_select" ON lesson_progress IS 'Students see their own progress. Teachers see progress of students in their batches. Admin sees all.';
COMMENT ON POLICY "lesson_progress_insert_student" ON lesson_progress IS 'Students can create their own progress records for enrolled batches.';
COMMENT ON POLICY "lesson_progress_update_student" ON lesson_progress IS 'Students can update their own progress. Completed progress is immutable (enforced by trigger).';

