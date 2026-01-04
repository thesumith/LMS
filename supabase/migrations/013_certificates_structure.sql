-- ============================================================================
-- Multi-Tenant LMS SaaS - Certificate System
-- ============================================================================
-- This migration creates tables for course completion certificates
-- Supports configurable eligibility rules and automatic certificate generation
-- ============================================================================

-- ============================================================================
-- COURSE_CERTIFICATE_RULES TABLE
-- ============================================================================
-- Defines eligibility rules for certificate issuance per course
-- Configured by Institute Admin
-- ============================================================================
CREATE TABLE course_certificate_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE RESTRICT,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    min_attendance_percentage INTEGER NOT NULL DEFAULT 75 CHECK (min_attendance_percentage >= 0 AND min_attendance_percentage <= 100),
    require_exam_pass BOOLEAN NOT NULL DEFAULT true,
    require_assignment_completion BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT course_certificate_rules_unique_per_course UNIQUE (course_id, deleted_at)
);

-- Indexes for course_certificate_rules
CREATE INDEX idx_course_certificate_rules_institute_id ON course_certificate_rules(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_course_certificate_rules_course_id ON course_certificate_rules(course_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_course_certificate_rules_is_active ON course_certificate_rules(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_course_certificate_rules_deleted_at ON course_certificate_rules(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- CERTIFICATES TABLE
-- ============================================================================
-- Stores issued certificates for students
-- One certificate per student per course per batch
-- ============================================================================
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    certificate_number VARCHAR(100) NOT NULL UNIQUE, -- Unique certificate identifier
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    issued_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL, -- NULL for auto-generated
    storage_path TEXT NOT NULL, -- Path to PDF in Supabase Storage
    is_reissued BOOLEAN NOT NULL DEFAULT false, -- True if certificate was reissued
    reissued_from_id UUID NULL REFERENCES certificates(id) ON DELETE SET NULL, -- Link to original if reissued
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT certificates_unique_per_student_course_batch UNIQUE (student_id, course_id, batch_id, deleted_at)
);

-- Indexes for certificates
CREATE INDEX idx_certificates_institute_id ON certificates(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_certificates_student_id ON certificates(student_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_certificates_course_id ON certificates(course_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_certificates_batch_id ON certificates(batch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_certificates_certificate_number ON certificates(certificate_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_certificates_issued_at ON certificates(issued_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_certificates_student_course ON certificates(student_id, course_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_certificates_deleted_at ON certificates(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- FUNCTION: Generate unique certificate number
-- ============================================================================
-- Format: INST-{institute_code}-{course_code}-{batch_year}-{sequential_number}
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_certificate_number(
    p_institute_id UUID,
    p_course_id UUID,
    p_batch_id UUID
)
RETURNS TEXT AS $$
DECLARE
    v_institute_code TEXT;
    v_course_code TEXT;
    v_batch_year TEXT;
    v_sequence INTEGER;
    v_cert_number TEXT;
BEGIN
    -- Get institute subdomain (first 3 chars uppercase)
    SELECT UPPER(LEFT(subdomain, 3)) INTO v_institute_code
    FROM institutes
    WHERE id = p_institute_id;
    
    -- Get course code
    SELECT code INTO v_course_code
    FROM courses
    WHERE id = p_course_id;
    
    -- Get batch year from start_date
    SELECT TO_CHAR(start_date, 'YYYY') INTO v_batch_year
    FROM batches
    WHERE id = p_batch_id;
    
    -- Get next sequence number for this combination
    -- Extract the last part of certificate number (sequence) and find max
    SELECT COALESCE(
        MAX(
            CASE 
                WHEN certificate_number LIKE 'CERT-' || v_institute_code || '-' || v_course_code || '-' || v_batch_year || '-%'
                THEN CAST(SPLIT_PART(certificate_number, '-', -1) AS INTEGER)
                ELSE 0
            END
        ), 0
    ) + 1
    INTO v_sequence
    FROM certificates
    WHERE institute_id = p_institute_id
        AND course_id = p_course_id
        AND batch_id = p_batch_id
        AND deleted_at IS NULL;
    
    -- Generate certificate number
    v_cert_number := 'CERT-' || v_institute_code || '-' || v_course_code || '-' || v_batch_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
    
    RETURN v_cert_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Evaluate certificate eligibility
-- ============================================================================
-- Checks if student meets all eligibility requirements for certificate
-- Returns eligibility status and details
-- ============================================================================
CREATE OR REPLACE FUNCTION evaluate_certificate_eligibility(
    p_student_id UUID,
    p_course_id UUID,
    p_batch_id UUID
)
RETURNS TABLE (
    is_eligible BOOLEAN,
    attendance_percentage NUMERIC,
    meets_attendance BOOLEAN,
    exam_passed BOOLEAN,
    assignments_completed BOOLEAN,
    eligibility_details JSONB
) AS $$
DECLARE
    v_rule RECORD;
    v_attendance_percentage NUMERIC;
    v_total_sessions INTEGER;
    v_present_sessions INTEGER;
    v_exam_passed BOOLEAN;
    v_assignments_completed BOOLEAN;
    v_is_eligible BOOLEAN;
    v_details JSONB;
BEGIN
    -- Get certificate rules for course
    SELECT * INTO v_rule
    FROM course_certificate_rules
    WHERE course_id = p_course_id
        AND is_active = true
        AND deleted_at IS NULL;
    
    -- If no rules defined, student is not eligible
    IF v_rule IS NULL THEN
        RETURN QUERY SELECT
            false::BOOLEAN,
            0::NUMERIC,
            false::BOOLEAN,
            false::BOOLEAN,
            false::BOOLEAN,
            '{"reason": "No certificate rules defined for this course"}'::JSONB;
        RETURN;
    END IF;
    
    -- Calculate attendance percentage
    SELECT 
        COUNT(*) FILTER (WHERE ar.status = 'present' OR ar.status = 'late' OR ar.status = 'excused')::NUMERIC,
        COUNT(*)::NUMERIC
    INTO v_present_sessions, v_total_sessions
    FROM attendance_sessions as
    LEFT JOIN attendance_records ar ON as.id = ar.session_id
    WHERE as.batch_id = p_batch_id
        AND ar.student_id = p_student_id
        AND as.deleted_at IS NULL
        AND ar.deleted_at IS NULL;
    
    IF v_total_sessions > 0 THEN
        v_attendance_percentage := (v_present_sessions / v_total_sessions) * 100;
    ELSE
        v_attendance_percentage := 0;
    END IF;
    
    -- Check attendance requirement
    DECLARE
        v_meets_attendance BOOLEAN := v_attendance_percentage >= v_rule.min_attendance_percentage;
    BEGIN
        -- Check exam pass requirement (if enabled)
        -- Note: This assumes an exams table exists. If not, set to true for now.
        -- TODO: Implement exam pass check when exams table is created
        v_exam_passed := true; -- Placeholder - implement when exams exist
        
        -- Check assignment completion requirement (if enabled)
        IF v_rule.require_assignment_completion THEN
            -- Check if all assignments are submitted
            SELECT COUNT(*) = (
                SELECT COUNT(*)
                FROM assignments
                WHERE batch_id = p_batch_id
                    AND deleted_at IS NULL
            )
            INTO v_assignments_completed
            FROM assignment_submissions
            WHERE batch_id = p_batch_id
                AND student_id = p_student_id
                AND deleted_at IS NULL;
        ELSE
            v_assignments_completed := true; -- Not required
        END IF;
        
        -- Determine overall eligibility
        v_is_eligible := v_meets_attendance
            AND (NOT v_rule.require_exam_pass OR v_exam_passed)
            AND v_assignments_completed;
        
        -- Build eligibility details
        v_details := jsonb_build_object(
            'attendance_percentage', v_attendance_percentage,
            'min_attendance_required', v_rule.min_attendance_percentage,
            'meets_attendance', v_meets_attendance,
            'require_exam_pass', v_rule.require_exam_pass,
            'exam_passed', v_exam_passed,
            'require_assignment_completion', v_rule.require_assignment_completion,
            'assignments_completed', v_assignments_completed,
            'total_sessions', v_total_sessions,
            'present_sessions', v_present_sessions
        );
        
        RETURN QUERY SELECT
            v_is_eligible,
            v_attendance_percentage,
            v_meets_attendance,
            v_exam_passed,
            v_assignments_completed,
            v_details;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
CREATE TRIGGER update_course_certificate_rules_updated_at
    BEFORE UPDATE ON course_certificate_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_certificates_updated_at
    BEFORE UPDATE ON certificates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE course_certificate_rules IS 'Eligibility rules for certificate issuance per course. Configured by Institute Admin.';
COMMENT ON TABLE certificates IS 'Issued certificates for students. One certificate per student per course per batch.';

COMMENT ON COLUMN course_certificate_rules.min_attendance_percentage IS 'Minimum attendance percentage required (0-100)';
COMMENT ON COLUMN course_certificate_rules.require_exam_pass IS 'Whether student must pass exam to be eligible';
COMMENT ON COLUMN course_certificate_rules.require_assignment_completion IS 'Whether all assignments must be completed';
COMMENT ON COLUMN certificates.certificate_number IS 'Unique certificate identifier for verification';
COMMENT ON COLUMN certificates.storage_path IS 'Path to PDF certificate in Supabase Storage';
COMMENT ON COLUMN certificates.is_reissued IS 'True if certificate was reissued (replaces original)';

COMMENT ON FUNCTION generate_certificate_number IS 'Generates unique certificate number based on institute, course, and batch';
COMMENT ON FUNCTION evaluate_certificate_eligibility IS 'Evaluates if student meets all eligibility requirements for certificate';

