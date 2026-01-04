-- ============================================================================
-- Multi-Tenant LMS SaaS - Course Content Structure
-- ============================================================================
-- This migration creates tables for Modules and Lessons with content management
-- All tables follow SaaS best practices: UUIDs, soft deletes, timestamps
-- ============================================================================

-- ============================================================================
-- MODULES TABLE
-- ============================================================================
-- Represents a module within a course
-- Modules are ordered within a course
-- ============================================================================
CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE RESTRICT,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sequence INTEGER NOT NULL, -- Order within course
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT modules_sequence_unique_per_course UNIQUE (course_id, sequence, deleted_at),
    CONSTRAINT modules_sequence_positive CHECK (sequence > 0)
);

-- Indexes for modules
CREATE INDEX idx_modules_institute_id ON modules(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_modules_course_id ON modules(course_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_modules_sequence ON modules(course_id, sequence) WHERE deleted_at IS NULL;
CREATE INDEX idx_modules_is_active ON modules(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_modules_deleted_at ON modules(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- LESSONS TABLE
-- ============================================================================
-- Represents a lesson within a module
-- Lessons can contain different content types (video, PDF, link, text)
-- Lessons are ordered within a module
-- ============================================================================
CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE RESTRICT,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('video', 'pdf', 'ppt', 'link', 'text')),
    content_url TEXT, -- For external links
    storage_path TEXT, -- For files stored in Supabase Storage
    sequence INTEGER NOT NULL, -- Order within module
    duration_minutes INTEGER, -- For video content
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT lessons_sequence_unique_per_module UNIQUE (module_id, sequence, deleted_at),
    CONSTRAINT lessons_sequence_positive CHECK (sequence > 0),
    CONSTRAINT lessons_content_check CHECK (
        -- If content_type is 'link', content_url must be provided
        (content_type = 'link' AND content_url IS NOT NULL) OR
        -- If content_type is 'video', 'pdf', or 'ppt', storage_path must be provided
        (content_type IN ('video', 'pdf', 'ppt') AND storage_path IS NOT NULL) OR
        -- If content_type is 'text', neither is required (stored in description)
        (content_type = 'text')
    )
);

-- Indexes for lessons
CREATE INDEX idx_lessons_institute_id ON lessons(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lessons_course_id ON lessons(course_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lessons_module_id ON lessons(module_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lessons_content_type ON lessons(content_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_lessons_sequence ON lessons(module_id, sequence) WHERE deleted_at IS NULL;
CREATE INDEX idx_lessons_is_active ON lessons(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_lessons_deleted_at ON lessons(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
-- Automatically update updated_at timestamp on row modification
-- ============================================================================

CREATE TRIGGER update_modules_updated_at
    BEFORE UPDATE ON modules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at
    BEFORE UPDATE ON lessons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE modules IS 'Course modules containing ordered lessons. Created by Institute Admin or assigned Teachers.';
COMMENT ON TABLE lessons IS 'Individual lessons within modules. Supports multiple content types (video, PDF, PPT, link, text).';

COMMENT ON COLUMN modules.sequence IS 'Order of module within course. Must be unique per course.';
COMMENT ON COLUMN lessons.content_type IS 'Type of content: video, pdf, ppt, link, or text';
COMMENT ON COLUMN lessons.content_url IS 'External URL for link-type lessons';
COMMENT ON COLUMN lessons.storage_path IS 'Path in Supabase Storage for file-based lessons (video, PDF, PPT)';
COMMENT ON COLUMN lessons.sequence IS 'Order of lesson within module. Must be unique per module.';
COMMENT ON COLUMN lessons.duration_minutes IS 'Duration in minutes (for video content)';

