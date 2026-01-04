-- ============================================================================
-- Multi-Tenant LMS SaaS - Attendance Tracking
-- ============================================================================
-- This migration creates tables for attendance sessions and records
-- Supports both manual (teacher-led) and automatic (lesson completion) attendance
-- ============================================================================

-- ============================================================================
-- ATTENDANCE_SESSIONS TABLE
-- ============================================================================
-- Represents an attendance session for a batch
-- Can be manual (teacher-led) or automatic (lesson-based)
-- ============================================================================
CREATE TABLE attendance_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    session_type VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (session_type IN ('manual', 'automatic')),
    lesson_id UUID NULL REFERENCES lessons(id) ON DELETE SET NULL, -- For automatic sessions
    title VARCHAR(255), -- Optional title for manual sessions
    description TEXT,
    is_locked BOOLEAN NOT NULL DEFAULT false, -- Locked sessions cannot be edited
    locked_at TIMESTAMPTZ NULL,
    locked_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT attendance_sessions_unique_per_batch_date UNIQUE (batch_id, session_date, session_type, lesson_id, deleted_at)
);

-- Indexes for attendance_sessions
CREATE INDEX idx_attendance_sessions_institute_id ON attendance_sessions(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_sessions_batch_id ON attendance_sessions(batch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_sessions_session_date ON attendance_sessions(session_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_sessions_session_type ON attendance_sessions(session_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_sessions_lesson_id ON attendance_sessions(lesson_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_sessions_is_locked ON attendance_sessions(is_locked) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_sessions_batch_date ON attendance_sessions(batch_id, session_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_sessions_deleted_at ON attendance_sessions(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- ATTENDANCE_RECORDS TABLE
-- ============================================================================
-- Represents individual student attendance records
-- Linked to attendance sessions
-- ============================================================================
CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE RESTRICT,
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    marked_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL, -- NULL for automatic
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT, -- Optional notes
    is_automatic BOOLEAN NOT NULL DEFAULT false, -- True if marked automatically from lesson progress
    source_lesson_progress_id UUID NULL REFERENCES lesson_progress(id) ON DELETE SET NULL, -- For audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT attendance_records_unique_per_session_student UNIQUE (session_id, student_id, deleted_at)
);

-- Indexes for attendance_records
CREATE INDEX idx_attendance_records_institute_id ON attendance_records(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_records_session_id ON attendance_records(session_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_records_batch_id ON attendance_records(batch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_records_student_id ON attendance_records(student_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_records_status ON attendance_records(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_records_is_automatic ON attendance_records(is_automatic) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_records_marked_at ON attendance_records(marked_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_records_student_batch ON attendance_records(student_id, batch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_records_deleted_at ON attendance_records(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- FUNCTION: Lock attendance session
-- ============================================================================
-- Locks a session to prevent further edits
-- ============================================================================
CREATE OR REPLACE FUNCTION lock_attendance_session(
    p_session_id UUID,
    p_locked_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_locked BOOLEAN;
BEGIN
    -- Check if already locked
    SELECT is_locked INTO v_is_locked
    FROM attendance_sessions
    WHERE id = p_session_id
        AND deleted_at IS NULL;
    
    IF v_is_locked THEN
        RETURN false; -- Already locked
    END IF;
    
    -- Lock the session
    UPDATE attendance_sessions
    SET is_locked = true,
        locked_at = now(),
        locked_by = p_locked_by
    WHERE id = p_session_id
        AND deleted_at IS NULL;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Create automatic attendance from lesson progress
-- ============================================================================
-- Creates attendance records when lesson is completed
-- Includes audit trail linking to lesson_progress
-- ============================================================================
CREATE OR REPLACE FUNCTION create_automatic_attendance(
    p_lesson_progress_id UUID,
    p_lesson_id UUID,
    p_batch_id UUID,
    p_student_id UUID,
    p_institute_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
    v_session_date DATE;
    v_lesson_date DATE;
BEGIN
    -- Get lesson completion date from lesson_progress
    SELECT completed_at::DATE INTO v_lesson_date
    FROM lesson_progress
    WHERE id = p_lesson_progress_id
        AND deleted_at IS NULL;
    
    IF v_lesson_date IS NULL THEN
        RAISE EXCEPTION 'Lesson progress must be completed to create automatic attendance';
    END IF;
    
    v_session_date := v_lesson_date;
    
    -- Check if automatic session already exists for this lesson and date
    SELECT id INTO v_session_id
    FROM attendance_sessions
    WHERE batch_id = p_batch_id
        AND session_date = v_session_date
        AND session_type = 'automatic'
        AND lesson_id = p_lesson_id
        AND deleted_at IS NULL;
    
    -- Create session if it doesn't exist
    IF v_session_id IS NULL THEN
        INSERT INTO attendance_sessions (
            institute_id,
            batch_id,
            session_date,
            session_type,
            lesson_id,
            title,
            is_locked,
            created_by
        )
        VALUES (
            p_institute_id,
            p_batch_id,
            v_session_date,
            'automatic',
            p_lesson_id,
            'Automatic attendance from lesson completion',
            false, -- Automatic sessions are not locked by default
            (SELECT id FROM profiles WHERE id = p_student_id LIMIT 1) -- System user
        )
        RETURNING id INTO v_session_id;
    END IF;
    
    -- Create attendance record if it doesn't exist
    INSERT INTO attendance_records (
        institute_id,
        session_id,
        batch_id,
        student_id,
        status,
        is_automatic,
        source_lesson_progress_id,
        marked_at
    )
    VALUES (
        p_institute_id,
        v_session_id,
        p_batch_id,
        p_student_id,
        'present',
        true,
        p_lesson_progress_id,
        now()
    )
    ON CONFLICT (session_id, student_id, deleted_at) DO UPDATE
    SET status = 'present',
        is_automatic = true,
        source_lesson_progress_id = p_lesson_progress_id,
        marked_at = now(),
        updated_at = now();
    
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Auto-create attendance when lesson is completed
-- ============================================================================
-- Automatically creates attendance record when lesson_progress is marked complete
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_auto_attendance_on_lesson_complete()
RETURNS TRIGGER AS $$
DECLARE
    v_lesson_id UUID;
    v_batch_id UUID;
    v_student_id UUID;
    v_institute_id UUID;
BEGIN
    -- Only trigger when lesson is marked as completed (completed_at is set)
    IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
        -- Get lesson and batch information from the updated record
        SELECT lesson_id, batch_id, student_id, institute_id
        INTO v_lesson_id, v_batch_id, v_student_id, v_institute_id
        FROM lesson_progress
        WHERE id = NEW.id;
        
        IF v_lesson_id IS NOT NULL AND v_batch_id IS NOT NULL AND v_student_id IS NOT NULL AND v_institute_id IS NOT NULL THEN
            -- Create automatic attendance
            PERFORM create_automatic_attendance(
                NEW.id,
                v_lesson_id,
                v_batch_id,
                v_student_id,
                v_institute_id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on lesson_progress table
CREATE TRIGGER auto_attendance_on_lesson_complete
    AFTER UPDATE ON lesson_progress
    FOR EACH ROW
    WHEN (NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL)
    EXECUTE FUNCTION trigger_auto_attendance_on_lesson_complete();

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
CREATE TRIGGER update_attendance_sessions_updated_at
    BEFORE UPDATE ON attendance_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_records_updated_at
    BEFORE UPDATE ON attendance_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE attendance_sessions IS 'Attendance sessions for batches. Can be manual (teacher-led) or automatic (from lesson completion).';
COMMENT ON TABLE attendance_records IS 'Individual student attendance records linked to sessions. Includes audit trail for automatic attendance.';

COMMENT ON COLUMN attendance_sessions.session_type IS 'Type of session: manual (teacher-led) or automatic (from lesson completion)';
COMMENT ON COLUMN attendance_sessions.is_locked IS 'Locked sessions cannot be edited. Prevents changes after session ends.';
COMMENT ON COLUMN attendance_sessions.lesson_id IS 'Lesson ID for automatic sessions (NULL for manual sessions)';
COMMENT ON COLUMN attendance_records.is_automatic IS 'True if marked automatically from lesson progress';
COMMENT ON COLUMN attendance_records.source_lesson_progress_id IS 'Link to lesson_progress record for audit trail (NULL for manual attendance)';
COMMENT ON COLUMN attendance_records.status IS 'Attendance status: present, absent, late, excused';

COMMENT ON FUNCTION create_automatic_attendance IS 'Creates attendance record when lesson is completed. Includes audit trail.';
COMMENT ON FUNCTION lock_attendance_session IS 'Locks an attendance session to prevent further edits.';

