-- ============================================================================
-- Multi-Tenant LMS SaaS - Class Sessions (Live Classes) Structure
-- ============================================================================
-- Adds teacher-scheduled classes per batch (with meeting links) and materials.
-- All tables follow SaaS best practices: UUIDs, soft deletes, timestamps.
-- ============================================================================

-- ============================================================================
-- CLASS_SESSIONS TABLE
-- ============================================================================
-- Represents a scheduled live class for a specific batch of a course.
-- Teachers create sessions for batches they are assigned to.
-- Students can view sessions for batches they are enrolled in.
-- ============================================================================
CREATE TABLE class_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE RESTRICT,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

    title VARCHAR(255) NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NULL CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    meeting_link TEXT NOT NULL,

    is_cancelled BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- ============================================================================
-- DATA INTEGRITY TRIGGERS
-- ============================================================================
-- Ensure institute_id and course_id are always consistent with batch_id.
-- This prevents accidental cross-tenant/cross-course mismatches at the DB layer.
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_class_session_from_batch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_institute_id UUID;
    v_course_id UUID;
BEGIN
    SELECT b.institute_id, b.course_id
    INTO v_institute_id, v_course_id
    FROM batches b
    WHERE b.id = NEW.batch_id
      AND b.deleted_at IS NULL;

    IF v_institute_id IS NULL OR v_course_id IS NULL THEN
        RAISE EXCEPTION 'Invalid batch_id for class session';
    END IF;

    NEW.institute_id := v_institute_id;
    NEW.course_id := v_course_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER sync_class_sessions_from_batch
    BEFORE INSERT OR UPDATE OF batch_id ON class_sessions
    FOR EACH ROW
    EXECUTE FUNCTION sync_class_session_from_batch();

-- Indexes for class_sessions
CREATE INDEX idx_class_sessions_institute_id ON class_sessions(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_class_sessions_batch_id ON class_sessions(batch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_class_sessions_course_id ON class_sessions(course_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_class_sessions_teacher_id ON class_sessions(teacher_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_class_sessions_scheduled_at ON class_sessions(scheduled_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_class_sessions_deleted_at ON class_sessions(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- CLASS_SESSION_MATERIALS TABLE
-- ============================================================================
-- Materials for a class session stored in Supabase Storage (course-content bucket).
-- Storage path uses institute/course/batch/class folders.
-- ============================================================================
CREATE TABLE class_session_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE RESTRICT,
    class_session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

    title VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    content_type VARCHAR(255) NULL,
    file_size_bytes BIGINT NULL CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,

    CONSTRAINT class_session_materials_unique_path UNIQUE (class_session_id, storage_path, deleted_at)
);

-- Ensure institute_id is consistent with class_session_id
CREATE OR REPLACE FUNCTION sync_class_session_material_institute()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_institute_id UUID;
BEGIN
    SELECT cs.institute_id
    INTO v_institute_id
    FROM class_sessions cs
    WHERE cs.id = NEW.class_session_id
      AND cs.deleted_at IS NULL;

    IF v_institute_id IS NULL THEN
        RAISE EXCEPTION 'Invalid class_session_id for class session material';
    END IF;

    NEW.institute_id := v_institute_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER sync_class_session_materials_institute
    BEFORE INSERT OR UPDATE OF class_session_id ON class_session_materials
    FOR EACH ROW
    EXECUTE FUNCTION sync_class_session_material_institute();

-- Indexes for class_session_materials
CREATE INDEX idx_class_session_materials_institute_id ON class_session_materials(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_class_session_materials_class_session_id ON class_session_materials(class_session_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_class_session_materials_uploaded_by ON class_session_materials(uploaded_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_class_session_materials_deleted_at ON class_session_materials(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
CREATE TRIGGER update_class_sessions_updated_at
    BEFORE UPDATE ON class_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_class_session_materials_updated_at
    BEFORE UPDATE ON class_session_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE class_sessions IS 'Teacher-scheduled live class sessions per batch with join link.';
COMMENT ON TABLE class_session_materials IS 'Files/materials for a class session stored in Supabase Storage.';


