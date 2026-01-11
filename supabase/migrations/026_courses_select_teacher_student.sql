-- ============================================================================
-- Multi-Tenant LMS SaaS - Courses RLS: Teacher/Student SELECT
-- ============================================================================
-- The original `courses_select` policy only allowed SUPER_ADMIN and INSTITUTE_ADMIN.
-- Teacher and Student screens frequently need course metadata (name/code) for
-- batches they are assigned/enrolled in. This policy enables that safely.
-- ============================================================================

-- SELECT: Teachers can see courses for batches they teach; Students can see courses for batches they are enrolled in
CREATE POLICY "courses_select_teacher_student"
ON courses
FOR SELECT
USING (
    deleted_at IS NULL
    AND (
        -- SUPER_ADMIN already allowed via existing policy, but keep harmless redundancy
        is_super_admin()
        OR
        (has_role('TEACHER')
            AND institute_id = get_user_institute_id()
            AND id IN (
                SELECT DISTINCT b.course_id
                FROM batches b
                INNER JOIN batch_teachers bt ON b.id = bt.batch_id
                WHERE bt.teacher_id = auth.uid()
                  AND b.deleted_at IS NULL
                  AND bt.deleted_at IS NULL
            ))
        OR
        (has_role('STUDENT')
            AND institute_id = get_user_institute_id()
            AND id IN (
                SELECT DISTINCT b.course_id
                FROM batches b
                INNER JOIN batch_students bs ON b.id = bs.batch_id
                WHERE bs.student_id = auth.uid()
                  AND bs.status = 'active'
                  AND b.deleted_at IS NULL
                  AND bs.deleted_at IS NULL
            ))
    )
);

COMMENT ON POLICY "courses_select_teacher_student" ON courses IS 'Allows TEACHER/STUDENT to read course metadata only for courses in batches they can access.';


