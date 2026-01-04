-- ============================================================================
-- Multi-Tenant LMS SaaS - Certificates RLS Policies
-- ============================================================================
-- This migration implements Row Level Security for certificates
-- All policies enforce strict tenant isolation and role-based access
-- ============================================================================

-- Enable RLS on all certificate tables
ALTER TABLE course_certificate_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COURSE_CERTIFICATE_RULES TABLE POLICIES
-- ============================================================================

-- SELECT: Teachers can read rules for their courses, Students can read rules for enrolled courses
CREATE POLICY "course_certificate_rules_select"
ON course_certificate_rules
FOR SELECT
USING (
    -- SUPER_ADMIN can see all active rules
    (is_super_admin() AND deleted_at IS NULL)
    OR
    -- INSTITUTE_ADMIN can see all rules in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id() 
        AND deleted_at IS NULL)
    OR
    -- TEACHER can see rules for courses they are assigned to
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
    -- STUDENT can see rules for courses in batches they are enrolled in
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

-- INSERT: Only Institute Admin can create certificate rules
CREATE POLICY "course_certificate_rules_insert_admin"
ON course_certificate_rules
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
);

-- UPDATE: Only Institute Admin can update certificate rules
CREATE POLICY "course_certificate_rules_update_admin"
ON course_certificate_rules
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
CREATE POLICY "course_certificate_rules_delete_admin"
ON course_certificate_rules
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
-- CERTIFICATES TABLE POLICIES
-- ============================================================================

-- SELECT: Students see their own certificates, Teachers see certificates for their batches
CREATE POLICY "certificates_select"
ON certificates
FOR SELECT
USING (
    -- SUPER_ADMIN can see all active certificates
    (is_super_admin() AND deleted_at IS NULL)
    OR
    -- INSTITUTE_ADMIN can see all certificates in their institute
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id() 
        AND deleted_at IS NULL)
    OR
    -- TEACHER can see certificates for batches they are assigned to (read-only)
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
    -- STUDENT can see their own certificates only
    (has_role('STUDENT') 
        AND student_id = auth.uid()
        AND deleted_at IS NULL)
);

-- INSERT: Institute Admin can issue certificates, System can auto-generate
CREATE POLICY "certificates_insert"
ON certificates
FOR INSERT
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id()
        AND student_id IN (
            SELECT id 
            FROM profiles 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        )
        AND course_id IN (
            SELECT id 
            FROM courses 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        )
        AND batch_id IN (
            SELECT id 
            FROM batches 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        )
        -- Prevent duplicate certificates
        AND NOT EXISTS (
            SELECT 1 
            FROM certificates 
            WHERE student_id = certificates.student_id
                AND course_id = certificates.course_id
                AND batch_id = certificates.batch_id
                AND deleted_at IS NULL
        ))
    -- System-generated certificates use SECURITY DEFINER function
);

-- UPDATE: Only Institute Admin can update certificates (for reissuing)
CREATE POLICY "certificates_update_admin"
ON certificates
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
CREATE POLICY "certificates_delete_admin"
ON certificates
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
COMMENT ON POLICY "course_certificate_rules_select" ON course_certificate_rules IS 'Teachers and Students can read rules for their courses. Admin can read all.';
COMMENT ON POLICY "certificates_select" ON certificates IS 'Students see their own certificates. Teachers see certificates for their batches (read-only).';
COMMENT ON POLICY "certificates_insert" ON certificates IS 'Institute Admin can issue certificates. System can auto-generate via SECURITY DEFINER function.';

