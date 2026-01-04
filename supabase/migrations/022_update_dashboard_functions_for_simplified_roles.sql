-- ============================================================================
-- Multi-Tenant LMS SaaS - Dashboard Functions Update (Simplified Roles)
-- ============================================================================
-- Fixes dashboard RPC functions that still referenced the dropped `roles` table.
-- After roles simplification, role checks must use `user_roles.role_name`.
-- ============================================================================

-- ============================================================================
-- FUNCTION: Institute Admin Dashboard Statistics
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
        -- Total students (role_name based)
        (SELECT COUNT(*)
         FROM profiles
         WHERE institute_id = p_institute_id
             AND id IN (
                 SELECT ur.user_id
                 FROM user_roles ur
                 WHERE ur.role_name = 'STUDENT'
                     AND ur.institute_id = p_institute_id
                     AND ur.deleted_at IS NULL
             )
             AND deleted_at IS NULL)::BIGINT AS total_students,
        
        -- Total teachers (role_name based)
        (SELECT COUNT(*)
         FROM profiles
         WHERE institute_id = p_institute_id
             AND id IN (
                 SELECT ur.user_id
                 FROM user_roles ur
                 WHERE ur.role_name = 'TEACHER'
                     AND ur.institute_id = p_institute_id
                     AND ur.deleted_at IS NULL
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
                COUNT(DISTINCT att_sess.id) FILTER (WHERE ar.status IN ('present', 'late', 'excused')) AS present_sessions,
                COUNT(DISTINCT att_sess.id) AS total_sessions
            FROM attendance_sessions att_sess
            INNER JOIN attendance_records ar ON att_sess.id = ar.session_id
            WHERE att_sess.institute_id = p_institute_id
                AND att_sess.deleted_at IS NULL
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

COMMENT ON FUNCTION get_institute_admin_dashboard IS 'Returns aggregated statistics for institute admin dashboard. Updated for simplified roles (role_name).';


