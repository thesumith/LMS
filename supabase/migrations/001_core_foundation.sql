-- ============================================================================
-- Multi-Tenant LMS SaaS - Core Database Foundation
-- ============================================================================
-- This migration creates the foundational tables for a multi-tenant LMS
-- All tables follow SaaS best practices: UUIDs, soft deletes, timestamps
-- ============================================================================

-- Enable required extensions
-- ============================================================================
-- Enable UUID extension (Supabase has this enabled by default, but ensure it's available)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For subdomain text search performance

-- Ensure gen_random_uuid() function is available
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'uuid_generate_v4') THEN
        CREATE FUNCTION gen_random_uuid() RETURNS uuid AS '$libdir/uuid-ossp', 'uuid_generate_v4' LANGUAGE C STRICT;
    END IF;
END $$;

-- ============================================================================
-- INSTITUTES TABLE
-- ============================================================================
-- Stores tenant (institute) information
-- Subdomain is the tenant identifier used in URL routing
-- ============================================================================
CREATE TABLE institutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- Indexes for institutes
CREATE INDEX idx_institutes_subdomain ON institutes(subdomain) WHERE deleted_at IS NULL;
CREATE INDEX idx_institutes_status ON institutes(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_institutes_deleted_at ON institutes(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- ROLES TABLE
-- ============================================================================
-- Defines system roles: SUPER_ADMIN, INSTITUTE_ADMIN, TEACHER, STUDENT
-- Roles are platform-wide, not tenant-specific
-- ============================================================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- Index for roles
CREATE INDEX idx_roles_name ON roles(name) WHERE deleted_at IS NULL;

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
-- User profile data linked to Supabase auth.users
-- Each user belongs to exactly one institute (except SUPER_ADMIN)
-- ============================================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    institute_id UUID NULL REFERENCES institutes(id) ON DELETE RESTRICT,
    must_change_password BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255) NOT NULL, -- Denormalized from auth.users for easier queries
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
    -- Note: institute_id NULL validation for SUPER_ADMIN will be enforced via RLS/application logic
);

-- Indexes for profiles
CREATE INDEX idx_profiles_institute_id ON profiles(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_email ON profiles(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_is_active ON profiles(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_must_change_password ON profiles(must_change_password) WHERE deleted_at IS NULL AND must_change_password = true;
CREATE INDEX idx_profiles_deleted_at ON profiles(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- USER_ROLES TABLE
-- ============================================================================
-- Many-to-many relationship between users and roles
-- Users can have multiple roles (e.g., Teacher + Institute Admin)
-- ============================================================================
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    institute_id UUID NULL REFERENCES institutes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    -- Note: Unique constraint allows multiple soft-deleted rows with same values
    -- Application logic will enforce: SUPER_ADMIN role doesn't need institute_id, others do
    UNIQUE(user_id, role_id, institute_id, deleted_at)
);

-- Indexes for user_roles
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_institute_id ON user_roles(institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_user_institute ON user_roles(user_id, institute_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_deleted_at ON user_roles(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- AUDIT_LOGS TABLE
-- ============================================================================
-- Tracks all significant actions for compliance and debugging
-- Cross-tenant table (no institute_id) - platform-wide audit trail
-- ============================================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
    institute_id UUID NULL REFERENCES institutes(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for audit_logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_institute_id ON audit_logs(institute_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_institute_created ON audit_logs(institute_id, created_at DESC) WHERE institute_id IS NOT NULL;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
-- Automatically update updated_at timestamp on row modification
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_institutes_updated_at
    BEFORE UPDATE ON institutes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INSERT DEFAULT ROLES
-- ============================================================================
-- Platform-wide roles that define user permissions
-- ============================================================================
INSERT INTO roles (name, description) VALUES
    ('SUPER_ADMIN', 'Platform owner with cross-tenant access'),
    ('INSTITUTE_ADMIN', 'Administrator of a specific institute'),
    ('TEACHER', 'Teacher within an institute'),
    ('STUDENT', 'Student within an institute')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE institutes IS 'Multi-tenant table storing institute (tenant) information. Subdomain is the unique tenant identifier.';
COMMENT ON TABLE roles IS 'Platform-wide role definitions. Roles are not tenant-specific.';
COMMENT ON TABLE profiles IS 'User profiles linked to Supabase auth.users. Each user belongs to one institute (except SUPER_ADMIN).';
COMMENT ON TABLE user_roles IS 'Many-to-many relationship between users and roles. Supports role assignment per institute.';
COMMENT ON TABLE audit_logs IS 'Platform-wide audit trail for compliance and debugging. No soft delete - permanent record.';

COMMENT ON COLUMN institutes.subdomain IS 'Unique subdomain identifier for tenant routing (e.g., "institute1" in institute1.platform.com)';
COMMENT ON COLUMN profiles.institute_id IS 'NULL allowed only for SUPER_ADMIN users. All other users must belong to an institute.';
COMMENT ON COLUMN profiles.must_change_password IS 'Flag indicating user must change temporary password on next login.';
COMMENT ON COLUMN user_roles.institute_id IS 'NULL for SUPER_ADMIN role only. All other roles must be scoped to an institute.';

