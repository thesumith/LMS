-- ============================================================================
-- Multi-Tenant LMS SaaS - Storage Bucket Creation
-- ============================================================================
-- This migration creates the storage bucket for course content.
-- Storage policies must be created separately via Supabase Dashboard or service role.
-- See: docs/STORAGE_SETUP_INSTRUCTIONS.md
-- ============================================================================

-- Create main content bucket (private)
-- Note: This may require elevated permissions. If it fails, create bucket via Dashboard.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'course-content',
    'course-content',
    false, -- Private bucket
    104857600, -- 100MB file size limit
    ARRAY[
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'application/pdf',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
        'application/vnd.openxmlformats-officedocument.presentationml.slideshow'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- NOTE: Storage policies cannot be created via regular migrations.
-- They require service role key permissions.
--
-- To create storage policies:
-- 1. Go to Supabase Dashboard > Storage > Policies
-- 2. Select 'course-content' bucket
-- 3. Create policies manually (see docs/STORAGE_SETUP_INSTRUCTIONS.md)
-- OR
-- 4. Run supabase/storage/policies.sql with service role key
-- ============================================================================

