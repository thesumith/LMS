-- ============================================================================
-- Migration: Fix student dashboard when `exams` table does not exist
-- ============================================================================
-- Context:
-- `get_student_dashboard` referenced `exams` unconditionally, causing:
--   relation "exams" does not exist
--
-- This migration rewrites the function to only query `exams` when the table
-- exists (via to_regclass + dynamic SQL). Otherwise returns an empty array.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_student_dashboard(
    p_student_id UUID,
    p_institute_id UUID
)
RETURNS TABLE (
    enrolled_courses_count BIGINT,
    total_progress_percentage NUMERIC,
    certificates_count BIGINT,
    upcoming_exams JSONB,
    recent_assignments JSONB,
    attendance_summary JSONB
) AS $$
DECLARE
    v_enrolled_courses_count BIGINT := 0;
    v_total_progress_percentage NUMERIC := 0;
    v_certificates_count BIGINT := 0;
    v_upcoming_exams JSONB := '[]'::jsonb;
    v_recent_assignments JSONB := '[]'::jsonb;
    v_attendance_summary JSONB := jsonb_build_object(
        'total_sessions', 0,
        'present_count', 0,
        'absent_count', 0,
        'late_count', 0,
        'attendance_percentage', 0
    );
BEGIN
    -- Enrolled courses count
    SELECT COUNT(DISTINCT b.course_id)::BIGINT
    INTO v_enrolled_courses_count
    FROM batch_students bs
    INNER JOIN batches b ON bs.batch_id = b.id
    WHERE bs.student_id = p_student_id
        AND bs.institute_id = p_institute_id
        AND bs.status = 'active'
        AND bs.deleted_at IS NULL
        AND b.deleted_at IS NULL
        AND b.institute_id = p_institute_id;

    -- Total progress percentage (across all enrolled courses)
    SELECT COALESCE(AVG(progress_percentage), 0)
    INTO v_total_progress_percentage
    FROM (
        SELECT
            c.id AS course_id,
            COUNT(DISTINCT l.id) FILTER (WHERE lp.completed_at IS NOT NULL)::NUMERIC /
            NULLIF(COUNT(DISTINCT l.id), 0)::NUMERIC * 100 AS progress_percentage
        FROM batch_students bs
        INNER JOIN batches b ON bs.batch_id = b.id
        INNER JOIN courses c ON b.course_id = c.id
        INNER JOIN modules m ON c.id = m.course_id
        INNER JOIN lessons l ON m.id = l.module_id
        LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.student_id = p_student_id
        WHERE bs.student_id = p_student_id
            AND bs.institute_id = p_institute_id
            AND bs.status = 'active'
            AND bs.deleted_at IS NULL
            AND b.deleted_at IS NULL
            AND c.deleted_at IS NULL
            AND m.deleted_at IS NULL
            AND l.deleted_at IS NULL
            AND b.institute_id = p_institute_id
            AND c.institute_id = p_institute_id
            AND m.institute_id = p_institute_id
            AND l.institute_id = p_institute_id
        GROUP BY c.id
    ) progress_stats;

    -- Certificates count
    SELECT COUNT(*)::BIGINT
    INTO v_certificates_count
    FROM certificates
    WHERE student_id = p_student_id
        AND institute_id = p_institute_id
        AND deleted_at IS NULL;

    -- Upcoming exams (next 30 days) - only if the table exists
    IF to_regclass('public.exams') IS NOT NULL THEN
        EXECUTE $sql$
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', e.id,
                    'title', e.title,
                    'exam_date', e.exam_date,
                    'batch_name', b.name,
                    'course_name', c.name
                ) ORDER BY e.exam_date ASC
            ), '[]'::jsonb)
            FROM exams e
            INNER JOIN batches b ON e.batch_id = b.id
            INNER JOIN courses c ON b.course_id = c.id
            INNER JOIN batch_students bs ON b.id = bs.batch_id
            WHERE bs.student_id = $1
                AND bs.institute_id = $2
                AND bs.status = 'active'
                AND e.exam_date >= CURRENT_DATE
                AND e.exam_date <= CURRENT_DATE + INTERVAL '30 days'
                AND e.deleted_at IS NULL
                AND bs.deleted_at IS NULL
                AND b.deleted_at IS NULL
                AND c.deleted_at IS NULL
                AND b.institute_id = $2
                AND c.institute_id = $2
                AND e.institute_id = $2
        $sql$
        INTO v_upcoming_exams
        USING p_student_id, p_institute_id;
    ELSE
        v_upcoming_exams := '[]'::jsonb;
    END IF;

    -- Recent assignments (next 7 days)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', a.id,
            'title', a.title,
            'due_date', a.due_date,
            'submission_deadline', a.submission_deadline,
            'batch_name', b.name,
            'course_name', c.name,
            'submitted', EXISTS(
                SELECT 1 FROM assignment_submissions asub
                WHERE asub.assignment_id = a.id
                    AND asub.student_id = p_student_id
                    AND asub.institute_id = p_institute_id
                    AND asub.deleted_at IS NULL
            )
        ) ORDER BY a.due_date ASC
    ), '[]'::jsonb)
    INTO v_recent_assignments
    FROM assignments a
    INNER JOIN batches b ON a.batch_id = b.id
    INNER JOIN courses c ON b.course_id = c.id
    INNER JOIN batch_students bs ON b.id = bs.batch_id
    WHERE bs.student_id = p_student_id
        AND bs.institute_id = p_institute_id
        AND bs.status = 'active'
        AND a.due_date >= CURRENT_DATE
        AND a.due_date <= CURRENT_DATE + INTERVAL '7 days'
        AND a.deleted_at IS NULL
        AND bs.deleted_at IS NULL
        AND b.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND a.institute_id = p_institute_id
        AND b.institute_id = p_institute_id
        AND c.institute_id = p_institute_id;

    -- Attendance summary (last 30 days)
    SELECT jsonb_build_object(
        'total_sessions', COUNT(DISTINCT att_sess.id),
        'present_count', COUNT(DISTINCT att_sess.id) FILTER (WHERE ar.status = 'present'),
        'absent_count', COUNT(DISTINCT att_sess.id) FILTER (WHERE ar.status = 'absent'),
        'late_count', COUNT(DISTINCT att_sess.id) FILTER (WHERE ar.status = 'late'),
        'attendance_percentage', CASE
            WHEN COUNT(DISTINCT att_sess.id) > 0
            THEN (
                COUNT(DISTINCT att_sess.id) FILTER (WHERE ar.status IN ('present', 'late', 'excused'))::NUMERIC /
                COUNT(DISTINCT att_sess.id)::NUMERIC
            ) * 100
            ELSE 0
        END
    )
    INTO v_attendance_summary
    FROM attendance_sessions att_sess
    LEFT JOIN attendance_records ar
        ON att_sess.id = ar.session_id
        AND ar.student_id = p_student_id
        AND ar.institute_id = p_institute_id
        AND ar.deleted_at IS NULL
    INNER JOIN batches b ON att_sess.batch_id = b.id
    INNER JOIN batch_students bs ON b.id = bs.batch_id
    WHERE bs.student_id = p_student_id
        AND bs.institute_id = p_institute_id
        AND bs.status = 'active'
        AND att_sess.session_date >= CURRENT_DATE - INTERVAL '30 days'
        AND att_sess.session_date <= CURRENT_DATE
        AND att_sess.deleted_at IS NULL
        AND bs.deleted_at IS NULL
        AND b.deleted_at IS NULL
        AND att_sess.institute_id = p_institute_id
        AND b.institute_id = p_institute_id;

    RETURN QUERY
    SELECT
        COALESCE(v_enrolled_courses_count, 0) AS enrolled_courses_count,
        COALESCE(v_total_progress_percentage, 0) AS total_progress_percentage,
        COALESCE(v_certificates_count, 0) AS certificates_count,
        COALESCE(v_upcoming_exams, '[]'::jsonb) AS upcoming_exams,
        COALESCE(v_recent_assignments, '[]'::jsonb) AS recent_assignments,
        COALESCE(v_attendance_summary, '{}'::jsonb) AS attendance_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_student_dashboard IS
    'Returns aggregated statistics for student dashboard. Guards optional exams feature (returns empty list if exams table does not exist).';


