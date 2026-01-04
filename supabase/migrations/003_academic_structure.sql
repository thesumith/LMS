-- ============================================================================
-- Multi-Tenant LMS SaaS - Academic Structure
-- ============================================================================
-- This migration creates tables for Courses, Batches, and Enrollments
-- All tables follow SaaS best practices: UUIDs, soft deletes, timestamps
-- ============================================================================

-- ============================================================================
-- COURSES TABLE
-- ============================================================================
-- Stores course definitions within an institute
-- Created and managed by Institute Admin
-- ============================================================================
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL, -- Course code (e.g., "CS101")
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT courses_code_unique_per_institute UNIQUE (institute_id, code, deleted_at)
);

-- Indexes for courses
CREATE INDEX idx_courses_institute_id ON courses(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_courses_code ON courses(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_courses_is_active ON courses(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_courses_institute_active ON courses(institute_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_courses_deleted_at ON courses(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- BATCHES TABLE
-- ============================================================================
-- Represents a specific instance of a course with dates and teachers
-- A course can have multiple batches (e.g., Fall 2024, Spring 2025)
-- ============================================================================
CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE RESTRICT,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL, -- Batch name (e.g., "Fall 2024", "Morning Batch")
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT batches_dates_check CHECK (end_date >= start_date)
);

-- Indexes for batches
CREATE INDEX idx_batches_institute_id ON batches(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_batches_course_id ON batches(course_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_batches_dates ON batches(start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_batches_is_active ON batches(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_batches_institute_course ON batches(institute_id, course_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_batches_deleted_at ON batches(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- BATCH_TEACHERS TABLE
-- ============================================================================
-- Many-to-many relationship between batches and teachers
-- A batch can have multiple teachers
-- ============================================================================
CREATE TABLE batch_teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT batch_teachers_unique UNIQUE (batch_id, teacher_id, deleted_at)
);

-- Indexes for batch_teachers
CREATE INDEX idx_batch_teachers_institute_id ON batch_teachers(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_batch_teachers_batch_id ON batch_teachers(batch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_batch_teachers_teacher_id ON batch_teachers(teacher_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_batch_teachers_batch_teacher ON batch_teachers(batch_id, teacher_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_batch_teachers_deleted_at ON batch_teachers(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- BATCH_STUDENTS TABLE (Enrollments)
-- ============================================================================
-- Represents student enrollment in a batch
-- Tracks enrollment status and dates
-- ============================================================================
CREATE TABLE batch_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL,
    dropped_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT batch_students_unique UNIQUE (batch_id, student_id, deleted_at),
    CONSTRAINT batch_students_status_dates_check CHECK (
        (status = 'active' AND completed_at IS NULL AND dropped_at IS NULL) OR
        (status = 'completed' AND completed_at IS NOT NULL AND dropped_at IS NULL) OR
        (status = 'dropped' AND dropped_at IS NOT NULL)
    )
);

-- Indexes for batch_students
CREATE INDEX idx_batch_students_institute_id ON batch_students(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_batch_students_batch_id ON batch_students(batch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_batch_students_student_id ON batch_students(student_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_batch_students_status ON batch_students(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_batch_students_batch_student ON batch_students(batch_id, student_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_batch_students_student_status ON batch_students(student_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_batch_students_deleted_at ON batch_students(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
-- Automatically update updated_at timestamp on row modification
-- ============================================================================

CREATE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON courses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batches_updated_at
    BEFORE UPDATE ON batches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batch_teachers_updated_at
    BEFORE UPDATE ON batch_teachers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batch_students_updated_at
    BEFORE UPDATE ON batch_students
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE courses IS 'Course definitions within an institute. Managed by Institute Admin.';
COMMENT ON TABLE batches IS 'Specific instances of courses with dates and teachers. A course can have multiple batches.';
COMMENT ON TABLE batch_teachers IS 'Many-to-many relationship between batches and teachers. A batch can have multiple teachers.';
COMMENT ON TABLE batch_students IS 'Student enrollments in batches. Tracks enrollment status and dates.';

COMMENT ON COLUMN courses.code IS 'Course code unique within an institute (e.g., "CS101", "MATH201")';
COMMENT ON COLUMN batches.name IS 'Batch identifier (e.g., "Fall 2024", "Morning Batch", "Weekend Batch")';
COMMENT ON COLUMN batch_students.status IS 'Enrollment status: active (currently enrolled), completed (finished), dropped (withdrawn)';

