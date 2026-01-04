-- ============================================================================
-- Multi-Tenant LMS SaaS - Lesson Progress Tracking
-- ============================================================================
-- This migration creates the lesson_progress table for tracking student progress
-- Progress is immutable once marked complete
-- ============================================================================

-- ============================================================================
-- LESSON_PROGRESS TABLE
-- ============================================================================
-- Tracks student progress through lessons
-- Immutable once completed (completed_at cannot be updated)
-- ============================================================================
CREATE TABLE lesson_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL,
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT lesson_progress_unique UNIQUE (student_id, lesson_id, batch_id, deleted_at),
    CONSTRAINT lesson_progress_completion_check CHECK (
        -- If completed_at is set, progress_percentage must be 100
        (completed_at IS NULL OR progress_percentage = 100)
    )
);

-- Indexes for lesson_progress
CREATE INDEX idx_lesson_progress_institute_id ON lesson_progress(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lesson_progress_student_id ON lesson_progress(student_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lesson_progress_lesson_id ON lesson_progress(lesson_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lesson_progress_batch_id ON lesson_progress(batch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lesson_progress_course_id ON lesson_progress(course_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lesson_progress_completed_at ON lesson_progress(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_lesson_progress_student_batch ON lesson_progress(student_id, batch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lesson_progress_student_course ON lesson_progress(student_id, course_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lesson_progress_deleted_at ON lesson_progress(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- FUNCTION: Prevent updating completed progress
-- ============================================================================
-- This function prevents overwriting completed progress
-- ============================================================================
CREATE OR REPLACE FUNCTION prevent_completed_progress_update()
RETURNS TRIGGER AS $$
BEGIN
    -- If old record has completed_at set, prevent any updates
    IF OLD.completed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot update completed progress. Progress is immutable once marked complete.';
    END IF;
    
    -- If new record is being marked as complete, set progress to 100
    IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
        NEW.progress_percentage = 100;
        NEW.completed_at = now();
    END IF;
    
    -- Update last_viewed_at if progress_percentage changed
    IF NEW.progress_percentage != OLD.progress_percentage THEN
        NEW.last_viewed_at = now();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce immutability
CREATE TRIGGER prevent_completed_progress_update_trigger
    BEFORE UPDATE ON lesson_progress
    FOR EACH ROW
    EXECUTE FUNCTION prevent_completed_progress_update();

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================
CREATE TRIGGER update_lesson_progress_updated_at
    BEFORE UPDATE ON lesson_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTION: Calculate course progress percentage
-- ============================================================================
-- Returns the percentage of lessons completed by a student in a course
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_course_progress(
    p_student_id UUID,
    p_course_id UUID,
    p_batch_id UUID
)
RETURNS TABLE (
    total_lessons INTEGER,
    completed_lessons INTEGER,
    progress_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH course_lessons AS (
        SELECT l.id
        FROM lessons l
        INNER JOIN modules m ON l.module_id = m.id
        WHERE m.course_id = p_course_id
            AND l.deleted_at IS NULL
            AND m.deleted_at IS NULL
    ),
    student_progress AS (
        SELECT 
            COUNT(*) FILTER (WHERE lp.completed_at IS NOT NULL) as completed,
            COUNT(*) as total
        FROM lesson_progress lp
        WHERE lp.student_id = p_student_id
            AND lp.course_id = p_course_id
            AND lp.batch_id = p_batch_id
            AND lp.lesson_id IN (SELECT id FROM course_lessons)
            AND lp.deleted_at IS NULL
    )
    SELECT 
        COALESCE(sp.total, 0)::INTEGER as total_lessons,
        COALESCE(sp.completed, 0)::INTEGER as completed_lessons,
        CASE 
            WHEN COALESCE(sp.total, 0) = 0 THEN 0
            ELSE ROUND((COALESCE(sp.completed, 0)::NUMERIC / sp.total::NUMERIC) * 100, 2)
        END as progress_percentage
    FROM student_progress sp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE lesson_progress IS 'Tracks student progress through lessons. Progress is immutable once marked complete.';
COMMENT ON COLUMN lesson_progress.completed_at IS 'Timestamp when lesson was completed. Once set, progress cannot be updated.';
COMMENT ON COLUMN lesson_progress.progress_percentage IS 'Progress percentage (0-100). Automatically set to 100 when completed.';
COMMENT ON FUNCTION prevent_completed_progress_update() IS 'Prevents updating progress once marked as complete. Enforces immutability.';
COMMENT ON FUNCTION calculate_course_progress(UUID, UUID, UUID) IS 'Calculates course progress percentage for a student in a specific batch.';

