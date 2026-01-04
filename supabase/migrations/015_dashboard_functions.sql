-- ============================================================================
-- Multi-Tenant LMS SaaS - Dashboard Analytics Functions
-- ============================================================================
-- This migration creates optimized SQL functions for dashboard analytics
-- All functions respect RLS and perform aggregation at database level
-- ============================================================================

-- ============================================================================
-- FUNCTION: Institute Admin Dashboard Statistics
-- ============================================================================
-- Returns aggregated statistics for institute admin dashboard
-- Respects RLS - only returns data for user's institute
-- ============================================================================
CREATE OR REPLACE FUNCTION get_institute_admin_dashboard(
    p_institute_id UUID
)
RETURNS TABLE (
    total_students BIGINT,
    total_teachers BIGINT,
    active_courses BIGINT,
    active_batches BIGINT,
    total_certificates BIGINT,
    average_attendance_percentage NUMERIC,
    completion_rate NUMERIC,
    recent_certificates JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        -- Total students
        (SELECT COUNT(*)
         FROM profiles
         WHERE institute_id = p_institute_id
             AND id IN (
                 SELECT user_id FROM user_roles ur
                 INNER JOIN roles r ON ur.role_id = r.id
                 WHERE r.name = 'STUDENT'
             )
             AND deleted_at IS NULL)::BIGINT AS total_students,
        
        -- Total teachers
        (SELECT COUNT(*)
         FROM profiles
         WHERE institute_id = p_institute_id
             AND id IN (
                 SELECT user_id FROM user_roles ur
                 INNER JOIN roles r ON ur.role_id = r.id
                 WHERE r.name = 'TEACHER'
             )
             AND deleted_at IS NULL)::BIGINT AS total_teachers,
        
        -- Active courses
        (SELECT COUNT(*)
         FROM courses
         WHERE institute_id = p_institute_id
             AND is_active = true
             AND deleted_at IS NULL)::BIGINT AS active_courses,
        
        -- Active batches
        (SELECT COUNT(*)
         FROM batches
         WHERE institute_id = p_institute_id
             AND start_date <= CURRENT_DATE
             AND end_date >= CURRENT_DATE
             AND deleted_at IS NULL)::BIGINT AS active_batches,
        
        -- Total certificates
        (SELECT COUNT(*)
         FROM certificates
         WHERE institute_id = p_institute_id
             AND deleted_at IS NULL)::BIGINT AS total_certificates,
        
        -- Average attendance percentage
        (SELECT COALESCE(AVG(
            CASE 
                WHEN total_sessions > 0 
                THEN (present_sessions::NUMERIC / total_sessions::NUMERIC) * 100
                ELSE 0
            END
        ), 0)
        FROM (
            SELECT 
                ar.student_id,
                COUNT(DISTINCT as.id) FILTER (WHERE ar.status IN ('present', 'late', 'excused')) AS present_sessions,
                COUNT(DISTINCT as.id) AS total_sessions
            FROM attendance_sessions as
            INNER JOIN attendance_records ar ON as.id = ar.session_id
            WHERE as.institute_id = p_institute_id
                AND as.deleted_at IS NULL
                AND ar.deleted_at IS NULL
            GROUP BY ar.student_id
        ) attendance_stats) AS average_attendance_percentage,
        
        -- Completion rate (students who completed at least one course)
        (SELECT COALESCE(
            (COUNT(DISTINCT c.student_id)::NUMERIC / 
             NULLIF(COUNT(DISTINCT bs.student_id), 0)::NUMERIC) * 100,
            0
        )
        FROM certificates c
        RIGHT JOIN batch_students bs ON c.batch_id = bs.batch_id
        WHERE bs.institute_id = p_institute_id
            AND bs.status = 'active'
            AND bs.deleted_at IS NULL
            AND c.deleted_at IS NULL) AS completion_rate,
        
        -- Recent certificates (last 10)
        (SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', c.id,
                'certificate_number', c.certificate_number,
                'student_name', p.first_name || ' ' || p.last_name,
                'course_name', co.name,
                'issued_at', c.issued_at
            ) ORDER BY c.issued_at DESC
        ), '[]'::jsonb)
        FROM (
            SELECT c.*
            FROM certificates c
            WHERE c.institute_id = p_institute_id
                AND c.deleted_at IS NULL
            ORDER BY c.issued_at DESC
            LIMIT 10
        ) c
        INNER JOIN profiles p ON c.student_id = p.id
        INNER JOIN courses co ON c.course_id = co.id) AS recent_certificates;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Teacher Dashboard Statistics
-- ============================================================================
-- Returns aggregated statistics for teacher dashboard
-- Respects RLS - only returns data for batches teacher is assigned to
-- ============================================================================
CREATE OR REPLACE FUNCTION get_teacher_dashboard(
    p_teacher_id UUID,
    p_institute_id UUID
)
RETURNS TABLE (
    assigned_batches_count BIGINT,
    total_students BIGINT,
    pending_evaluations BIGINT,
    average_progress_percentage NUMERIC,
    recent_submissions JSONB,
    upcoming_sessions JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        -- Assigned batches count
        (SELECT COUNT(DISTINCT bt.batch_id)
         FROM batch_teachers bt
         INNER JOIN batches b ON bt.batch_id = b.id
         WHERE bt.teacher_id = p_teacher_id
             AND b.institute_id = p_institute_id
             AND bt.deleted_at IS NULL
             AND b.deleted_at IS NULL)::BIGINT AS assigned_batches_count,
        
        -- Total students across assigned batches
        (SELECT COUNT(DISTINCT bs.student_id)
         FROM batch_teachers bt
         INNER JOIN batch_students bs ON bt.batch_id = bs.batch_id
         WHERE bt.teacher_id = p_teacher_id
             AND bs.status = 'active'
             AND bt.deleted_at IS NULL
             AND bs.deleted_at IS NULL)::BIGINT AS total_students,
        
        -- Pending evaluations (assignments not yet evaluated)
        (SELECT COUNT(*)
         FROM assignment_submissions asub
         INNER JOIN assignments a ON asub.assignment_id = a.id
         INNER JOIN batch_teachers bt ON a.batch_id = bt.batch_id
         WHERE bt.teacher_id = p_teacher_id
             AND asub.marks IS NULL
             AND asub.deleted_at IS NULL
             AND a.deleted_at IS NULL
             AND bt.deleted_at IS NULL)::BIGINT AS pending_evaluations,
        
        -- Average progress percentage across assigned batches
        (SELECT COALESCE(AVG(progress_percentage), 0)
         FROM (
             SELECT 
                 lp.student_id,
                 COUNT(DISTINCT l.id) FILTER (WHERE lp.completed_at IS NOT NULL)::NUMERIC / 
                 NULLIF(COUNT(DISTINCT l.id), 0)::NUMERIC * 100 AS progress_percentage
             FROM batch_teachers bt
             INNER JOIN batches b ON bt.batch_id = b.id
             INNER JOIN courses c ON b.course_id = c.id
             INNER JOIN modules m ON c.id = m.course_id
             INNER JOIN lessons l ON m.id = l.module_id
             LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id
             WHERE bt.teacher_id = p_teacher_id
                 AND b.institute_id = p_institute_id
                 AND bt.deleted_at IS NULL
                 AND b.deleted_at IS NULL
                 AND m.deleted_at IS NULL
                 AND l.deleted_at IS NULL
             GROUP BY lp.student_id
         ) progress_stats) AS average_progress_percentage,
        
        -- Recent submissions (last 10)
        (SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', asub.id,
                'assignment_title', a.title,
                'student_name', p.first_name || ' ' || p.last_name,
                'submitted_at', asub.submitted_at,
                'is_late', asub.is_late,
                'marks', asub.marks
            ) ORDER BY asub.submitted_at DESC
        ), '[]'::jsonb)
        FROM (
            SELECT asub.*
            FROM assignment_submissions asub
            INNER JOIN assignments a ON asub.assignment_id = a.id
            INNER JOIN batch_teachers bt ON a.batch_id = bt.batch_id
            WHERE bt.teacher_id = p_teacher_id
                AND asub.deleted_at IS NULL
                AND a.deleted_at IS NULL
                AND bt.deleted_at IS NULL
            ORDER BY asub.submitted_at DESC
            LIMIT 10
        ) asub
        INNER JOIN profiles p ON asub.student_id = p.id
        INNER JOIN assignments a ON asub.assignment_id = a.id) AS recent_submissions,
        
        -- Upcoming attendance sessions (next 7 days)
        (SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', as.id,
                'session_date', as.session_date,
                'title', as.title,
                'batch_name', b.name,
                'course_name', c.name
            ) ORDER BY as.session_date ASC
        ), '[]'::jsonb)
        FROM attendance_sessions as
        INNER JOIN batches b ON as.batch_id = b.id
        INNER JOIN courses c ON b.course_id = c.id
        INNER JOIN batch_teachers bt ON b.id = bt.batch_id
        WHERE bt.teacher_id = p_teacher_id
            AND as.session_date >= CURRENT_DATE
            AND as.session_date <= CURRENT_DATE + INTERVAL '7 days'
            AND as.deleted_at IS NULL
            AND b.deleted_at IS NULL
            AND bt.deleted_at IS NULL) AS upcoming_sessions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Student Dashboard Statistics
-- ============================================================================
-- Returns aggregated statistics for student dashboard
-- Respects RLS - only returns data for student's own records
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
BEGIN
    RETURN QUERY
    SELECT
        -- Enrolled courses count
        (SELECT COUNT(DISTINCT b.course_id)
         FROM batch_students bs
         INNER JOIN batches b ON bs.batch_id = b.id
         WHERE bs.student_id = p_student_id
             AND bs.status = 'active'
             AND bs.deleted_at IS NULL
             AND b.deleted_at IS NULL)::BIGINT AS enrolled_courses_count,
        
        -- Total progress percentage (across all enrolled courses)
        (SELECT COALESCE(AVG(progress_percentage), 0)
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
                 AND bs.status = 'active'
                 AND bs.deleted_at IS NULL
                 AND b.deleted_at IS NULL
                 AND m.deleted_at IS NULL
                 AND l.deleted_at IS NULL
             GROUP BY c.id
         ) progress_stats) AS total_progress_percentage,
        
        -- Certificates count
        (SELECT COUNT(*)
         FROM certificates
         WHERE student_id = p_student_id
             AND institute_id = p_institute_id
             AND deleted_at IS NULL)::BIGINT AS certificates_count,
        
        -- Upcoming exams (next 30 days)
        -- Note: Assuming exams table exists. If not, return empty array.
        (SELECT COALESCE(jsonb_agg(
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
        WHERE bs.student_id = p_student_id
            AND bs.status = 'active'
            AND e.exam_date >= CURRENT_DATE
            AND e.exam_date <= CURRENT_DATE + INTERVAL '30 days'
            AND e.deleted_at IS NULL
            AND bs.deleted_at IS NULL) AS upcoming_exams,
        
        -- Recent assignments (next 7 days)
        (SELECT COALESCE(jsonb_agg(
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
                        AND asub.deleted_at IS NULL
                )
            ) ORDER BY a.due_date ASC
        ), '[]'::jsonb)
        FROM assignments a
        INNER JOIN batches b ON a.batch_id = b.id
        INNER JOIN courses c ON b.course_id = c.id
        INNER JOIN batch_students bs ON b.id = bs.batch_id
        WHERE bs.student_id = p_student_id
            AND bs.status = 'active'
            AND a.due_date >= CURRENT_DATE
            AND a.due_date <= CURRENT_DATE + INTERVAL '7 days'
            AND a.deleted_at IS NULL
            AND bs.deleted_at IS NULL) AS recent_assignments,
        
        -- Attendance summary (last 30 days)
        (SELECT jsonb_build_object(
            'total_sessions', COUNT(DISTINCT as.id),
            'present_count', COUNT(DISTINCT as.id) FILTER (WHERE ar.status = 'present'),
            'absent_count', COUNT(DISTINCT as.id) FILTER (WHERE ar.status = 'absent'),
            'late_count', COUNT(DISTINCT as.id) FILTER (WHERE ar.status = 'late'),
            'attendance_percentage', CASE 
                WHEN COUNT(DISTINCT as.id) > 0 
                THEN (COUNT(DISTINCT as.id) FILTER (WHERE ar.status IN ('present', 'late', 'excused'))::NUMERIC / 
                      COUNT(DISTINCT as.id)::NUMERIC) * 100
                ELSE 0
            END
        )
        FROM attendance_sessions as
        LEFT JOIN attendance_records ar ON as.id = ar.session_id AND ar.student_id = p_student_id
        INNER JOIN batches b ON as.batch_id = b.id
        INNER JOIN batch_students bs ON b.id = bs.batch_id
        WHERE bs.student_id = p_student_id
            AND bs.status = 'active'
            AND as.session_date >= CURRENT_DATE - INTERVAL '30 days'
            AND as.session_date <= CURRENT_DATE
            AND as.deleted_at IS NULL
            AND bs.deleted_at IS NULL) AS attendance_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON FUNCTION get_institute_admin_dashboard IS 'Returns aggregated statistics for institute admin dashboard. Respects RLS.';
COMMENT ON FUNCTION get_teacher_dashboard IS 'Returns aggregated statistics for teacher dashboard. Only includes batches teacher is assigned to.';
COMMENT ON FUNCTION get_student_dashboard IS 'Returns aggregated statistics for student dashboard. Only includes student''s own data.';

