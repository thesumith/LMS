-- ============================================================================
-- Multi-Tenant LMS SaaS - Assignments RLS Policies
-- ============================================================================
-- This migration implements Row Level Security for assignments and submissions
-- All policies enforce strict tenant isolation and role-based access
-- ============================================================================

-- Enable RLS on all assignment tables
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ASSIGNMENTS TABLE POLICIES
-- ============================================================================

-- SELECT: Teachers see assignments for their batches, Students see assignments for enrolled batches
CREATE POLICY "assignments_select"
ON assignments
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
    -- TEACHER can see assignments for batches they are assigned to
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
    -- STUDENT can see assignments for batches they are enrolled in
    (has_role('STUDENT') 
        AND institute_id = get_user_institute_id()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_students 
            WHERE student_id = auth.uid()
                AND status = 'active'
                AND deleted_at IS NULL
        )
        AND deleted_at IS NULL)
);

-- INSERT: Only Teachers can create assignments for batches they are assigned to
CREATE POLICY "assignments_insert_teacher"
ON assignments
FOR INSERT
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id()
        AND batch_id IN (
            SELECT id 
            FROM batches 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        )
        AND course_id IN (
            SELECT id 
            FROM courses 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        ))
    OR
    -- TEACHER can create assignments for batches they are assigned to
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND created_by = auth.uid()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        )
        AND course_id IN (
            SELECT DISTINCT b.course_id
            FROM batches b
            INNER JOIN batch_teachers bt ON b.id = bt.batch_id
            WHERE bt.teacher_id = auth.uid()
                AND b.id = batch_id
                AND b.deleted_at IS NULL
                AND bt.deleted_at IS NULL
        ))
);

-- UPDATE: Teachers can update assignments for their batches (only if no submissions yet)
CREATE POLICY "assignments_update_teacher"
ON assignments
FOR UPDATE
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- TEACHER can update assignments for batches they are assigned to
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND created_by = auth.uid()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        )
        -- Can only edit if no submissions yet (enforced by trigger/application logic)
        AND can_edit_assignment(id))
)
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND created_by = auth.uid()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        )
        AND can_edit_assignment(id))
);

-- DELETE: Soft delete only, Teachers can delete their own assignments (only if no submissions)
CREATE POLICY "assignments_delete_teacher"
ON assignments
FOR UPDATE -- Using UPDATE because we soft delete via deleted_at
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- TEACHER can soft delete their own assignments (only if no submissions)
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND created_by = auth.uid()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        )
        AND can_edit_assignment(id))
)
WITH CHECK (
    (is_super_admin() OR has_role('INSTITUTE_ADMIN') OR has_role('TEACHER'))
    AND deleted_at IS NOT NULL
);

-- ============================================================================
-- ASSIGNMENT_SUBMISSIONS TABLE POLICIES
-- ============================================================================

-- SELECT: Students see their own submissions, Teachers see submissions for their batches
CREATE POLICY "assignment_submissions_select"
ON assignment_submissions
FOR SELECT
USING (
    -- SUPER_ADMIN can see all active submissions
    (is_super_admin() AND deleted_at IS NULL)
    OR
    -- INSTITUTE_ADMIN can see all submissions in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id() 
        AND deleted_at IS NULL)
    OR
    -- TEACHER can see submissions for batches they are assigned to
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
    -- STUDENT can see their own submissions only
    (has_role('STUDENT') 
        AND student_id = auth.uid()
        AND deleted_at IS NULL)
);

-- INSERT: Students can submit assignments for enrolled batches
CREATE POLICY "assignment_submissions_insert_student"
ON assignment_submissions
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
        -- Ensure assignment belongs to institute
        AND assignment_id IN (
            SELECT id 
            FROM assignments 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        ))
    OR
    -- STUDENT can submit assignments for batches they are enrolled in
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
        -- Ensure assignment belongs to the batch
        AND assignment_id IN (
            SELECT id 
            FROM assignments 
            WHERE batch_id = batch_id
                AND deleted_at IS NULL
        )
        -- Prevent duplicate submissions (enforced by unique constraint + application logic)
        AND NOT EXISTS (
            SELECT 1 
            FROM assignment_submissions 
            WHERE assignment_id = assignment_id
                AND student_id = auth.uid()
                AND deleted_at IS NULL
        ))
);

-- UPDATE: Teachers can evaluate submissions, Students cannot update (immutable once submitted)
CREATE POLICY "assignment_submissions_update"
ON assignment_submissions
FOR UPDATE
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- TEACHER can update submissions for batches they are assigned to (evaluation only)
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        ))
    -- Students cannot update submissions (immutable)
)
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- TEACHER can update marks and feedback
    -- Note: Immutability of storage_path, submitted_at, etc. is enforced via triggers/application logic
    (has_role('TEACHER') 
        AND institute_id = get_user_institute_id()
        AND batch_id IN (
            SELECT batch_id 
            FROM batch_teachers 
            WHERE teacher_id = auth.uid()
                AND deleted_at IS NULL
        ))
);

-- DELETE: Soft delete only, Teachers can delete submissions from their batches
CREATE POLICY "assignment_submissions_delete"
ON assignment_submissions
FOR UPDATE -- Using UPDATE because we soft delete via deleted_at
USING (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id())
    OR
    -- TEACHER can soft delete submissions from batches they are assigned to
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
    (is_super_admin() OR has_role('INSTITUTE_ADMIN') OR has_role('TEACHER'))
    AND deleted_at IS NOT NULL
);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON POLICY "assignments_select" ON assignments IS 'Teachers see assignments for their batches. Students see assignments for enrolled batches.';
COMMENT ON POLICY "assignments_insert_teacher" ON assignments IS 'Teachers can create assignments for batches they are assigned to.';
COMMENT ON POLICY "assignments_update_teacher" ON assignments IS 'Teachers can update assignments only if no submissions exist yet.';
COMMENT ON POLICY "assignment_submissions_select" ON assignment_submissions IS 'Students see their own submissions. Teachers see submissions for their batches.';
COMMENT ON POLICY "assignment_submissions_insert_student" ON assignment_submissions IS 'Students can submit assignments for enrolled batches. One submission per assignment.';
COMMENT ON POLICY "assignment_submissions_update" ON assignment_submissions IS 'Teachers can evaluate submissions (marks/feedback). Students cannot update submissions.';

