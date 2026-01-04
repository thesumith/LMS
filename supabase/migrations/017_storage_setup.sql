-- ============================================================================
-- Supabase Storage Setup for Course Content
-- ============================================================================
-- This migration sets up storage buckets and policies for course content
-- All buckets are private - access via signed URLs only
-- ============================================================================

-- ============================================================================
-- CREATE STORAGE BUCKET
-- ============================================================================
-- Single bucket for all institutes with structured paths
-- ============================================================================

-- Create main content bucket (private)
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
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
        'application/vnd.openxmlformats-officedocument.presentationml.slideshow'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE POLICIES FOR COURSE CONTENT
-- ============================================================================
-- Policies enforce access control based on user roles and institute membership
-- ============================================================================

-- Policy: Allow authenticated users to upload files to their institute's path
CREATE POLICY "course_content_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'course-content'
    AND (
        -- SUPER_ADMIN can upload anywhere
        is_super_admin()
        OR
        -- INSTITUTE_ADMIN can upload to their institute's path
        (has_role('INSTITUTE_ADMIN') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text)
        OR
        -- TEACHER can upload to courses they are assigned to
        (has_role('TEACHER') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'courses'
            AND (storage.foldername(name))[4] IN (
                SELECT DISTINCT b.course_id::text
                FROM batches b
                INNER JOIN batch_teachers bt ON b.id = bt.batch_id
                WHERE bt.teacher_id = auth.uid()
                    AND b.deleted_at IS NULL
                    AND bt.deleted_at IS NULL
            ))
    )
);

-- Policy: Allow authenticated users to read files from their institute's path
CREATE POLICY "course_content_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'course-content'
    AND (
        -- SUPER_ADMIN can read from anywhere
        is_super_admin()
        OR
        -- INSTITUTE_ADMIN can read from their institute's path
        (has_role('INSTITUTE_ADMIN') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text)
        OR
        -- TEACHER can read from courses they are assigned to
        (has_role('TEACHER') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'courses'
            AND (storage.foldername(name))[4] IN (
                SELECT DISTINCT b.course_id::text
                FROM batches b
                INNER JOIN batch_teachers bt ON b.id = bt.batch_id
                WHERE bt.teacher_id = auth.uid()
                    AND b.deleted_at IS NULL
                    AND bt.deleted_at IS NULL
            ))
        OR
        -- STUDENT can read from courses in batches they are enrolled in
        (has_role('STUDENT') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'courses'
            AND (storage.foldername(name))[4] IN (
                SELECT DISTINCT b.course_id::text
                FROM batches b
                INNER JOIN batch_students bs ON b.id = bs.batch_id
                WHERE bs.student_id = auth.uid()
                    AND bs.status = 'active'
                    AND b.deleted_at IS NULL
                    AND bs.deleted_at IS NULL
            ))
    )
);

-- Policy: Allow authenticated users to update files in their institute's path
CREATE POLICY "course_content_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'course-content'
    AND (
        is_super_admin()
        OR
        (has_role('INSTITUTE_ADMIN') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text)
        OR
        (has_role('TEACHER') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'courses'
            AND (storage.foldername(name))[4] IN (
                SELECT DISTINCT b.course_id::text
                FROM batches b
                INNER JOIN batch_teachers bt ON b.id = bt.batch_id
                WHERE bt.teacher_id = auth.uid()
                    AND b.deleted_at IS NULL
                    AND bt.deleted_at IS NULL
            ))
    )
)
WITH CHECK (
    bucket_id = 'course-content'
    AND (
        is_super_admin()
        OR
        (has_role('INSTITUTE_ADMIN') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text)
        OR
        (has_role('TEACHER') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'courses'
            AND (storage.foldername(name))[4] IN (
                SELECT DISTINCT b.course_id::text
                FROM batches b
                INNER JOIN batch_teachers bt ON b.id = bt.batch_id
                WHERE bt.teacher_id = auth.uid()
                    AND b.deleted_at IS NULL
                    AND bt.deleted_at IS NULL
            ))
    )
);

-- Policy: Allow authenticated users to delete files from their institute's path
CREATE POLICY "course_content_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'course-content'
    AND (
        is_super_admin()
        OR
        (has_role('INSTITUTE_ADMIN') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text)
        OR
        (has_role('TEACHER') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'courses'
            AND (storage.foldername(name))[4] IN (
                SELECT DISTINCT b.course_id::text
                FROM batches b
                INNER JOIN batch_teachers bt ON b.id = bt.batch_id
                WHERE bt.teacher_id = auth.uid()
                    AND b.deleted_at IS NULL
                    AND bt.deleted_at IS NULL
            ))
    )
);

