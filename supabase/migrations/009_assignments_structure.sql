-- ============================================================================
-- Multi-Tenant LMS SaaS - Assignments and Submissions
-- ============================================================================
-- This migration creates tables for assignments and student submissions
-- All tables follow SaaS best practices: UUIDs, soft deletes, timestamps
-- ============================================================================

-- ============================================================================
-- ASSIGNMENTS TABLE
-- ============================================================================
-- Represents an assignment created by a teacher for a batch
-- Can be edited until first submission is received
-- ============================================================================
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ NOT NULL,
    submission_deadline TIMESTAMPTZ NOT NULL,
    max_marks INTEGER NOT NULL CHECK (max_marks > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT assignments_dates_check CHECK (submission_deadline >= due_date)
);

-- Indexes for assignments
CREATE INDEX idx_assignments_institute_id ON assignments(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_batch_id ON assignments(batch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_course_id ON assignments(course_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_created_by ON assignments(created_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_due_date ON assignments(due_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_submission_deadline ON assignments(submission_deadline) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_is_active ON assignments(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_batch_active ON assignments(batch_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_deleted_at ON assignments(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- ASSIGNMENT_SUBMISSIONS TABLE
-- ============================================================================
-- Represents a student's submission for an assignment
-- One submission per student per assignment
-- ============================================================================
CREATE TABLE assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE RESTRICT,
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT, -- File size in bytes
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_late BOOLEAN NOT NULL DEFAULT false,
    marks INTEGER CHECK (marks IS NULL OR (marks >= 0)),
    feedback TEXT,
    evaluated_at TIMESTAMPTZ NULL,
    evaluated_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT assignment_submissions_unique UNIQUE (assignment_id, student_id, deleted_at)
    -- Note: marks validation against max_marks is enforced via trigger/application logic
    -- PostgreSQL doesn't allow subqueries in CHECK constraints
);

-- Indexes for assignment_submissions
CREATE INDEX idx_assignment_submissions_institute_id ON assignment_submissions(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignment_submissions_assignment_id ON assignment_submissions(assignment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignment_submissions_batch_id ON assignment_submissions(batch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignment_submissions_student_id ON assignment_submissions(student_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignment_submissions_submitted_at ON assignment_submissions(submitted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignment_submissions_is_late ON assignment_submissions(is_late) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignment_submissions_evaluated_at ON assignment_submissions(evaluated_at) WHERE evaluated_at IS NOT NULL;
CREATE INDEX idx_assignment_submissions_assignment_student ON assignment_submissions(assignment_id, student_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignment_submissions_deleted_at ON assignment_submissions(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- FUNCTION: Check if assignment can be edited
-- ============================================================================
-- Returns true if assignment can be edited (no submissions yet)
-- ============================================================================
CREATE OR REPLACE FUNCTION can_edit_assignment(p_assignment_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1
        FROM assignment_submissions
        WHERE assignment_id = p_assignment_id
            AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Mark submission as late
-- ============================================================================
-- Automatically marks submission as late if submitted after deadline
-- ============================================================================
CREATE OR REPLACE FUNCTION check_late_submission()
RETURNS TRIGGER AS $$
DECLARE
    v_deadline TIMESTAMPTZ;
BEGIN
    SELECT submission_deadline INTO v_deadline
    FROM assignments
    WHERE id = NEW.assignment_id;
    
    IF v_deadline IS NOT NULL AND NEW.submitted_at > v_deadline THEN
        NEW.is_late = true;
    ELSE
        NEW.is_late = false;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check late submission
CREATE TRIGGER check_late_submission_trigger
    BEFORE INSERT OR UPDATE ON assignment_submissions
    FOR EACH ROW
    EXECUTE FUNCTION check_late_submission();

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
CREATE TRIGGER update_assignments_updated_at
    BEFORE UPDATE ON assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignment_submissions_updated_at
    BEFORE UPDATE ON assignment_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE assignments IS 'Assignments created by teachers for batches. Can be edited until first submission.';
COMMENT ON TABLE assignment_submissions IS 'Student submissions for assignments. One submission per student per assignment.';

COMMENT ON COLUMN assignments.due_date IS 'Date when assignment is due (shown to students)';
COMMENT ON COLUMN assignments.submission_deadline IS 'Final deadline for submissions (used to determine late submissions)';
COMMENT ON COLUMN assignments.max_marks IS 'Maximum marks for this assignment';
COMMENT ON COLUMN assignment_submissions.is_late IS 'Automatically set to true if submitted after submission_deadline';
COMMENT ON COLUMN assignment_submissions.marks IS 'Marks awarded by teacher (must be <= assignment.max_marks)';
COMMENT ON COLUMN assignment_submissions.evaluated_at IS 'Timestamp when teacher evaluated the submission';
COMMENT ON COLUMN assignment_submissions.evaluated_by IS 'Teacher who evaluated the submission';

