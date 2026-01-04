-- ============================================================================
-- Supabase Storage Policies for Course Content
-- ============================================================================
-- ⚠️  WARNING: This file CANNOT be run directly via SQL editor or migrations.
-- Storage policies require OWNER-level permissions on storage.objects table.
--
-- ✅ RECOMMENDED: Create policies via Supabase Dashboard
--    1. Go to Storage > Policies > course-content bucket
--    2. Click "New Policy" for each policy below
--    3. Copy policy definitions from: supabase/storage/policies-dashboard.sql
--    4. See: docs/STORAGE_SETUP_INSTRUCTIONS.md for detailed steps
--
-- ❌ This file is for reference only. Even with service role key, it may fail.
--    Supabase Dashboard is the only reliable way to create storage policies.
-- ============================================================================

-- ============================================================================
-- NOTE: DROP POLICY commands also require owner permissions.
-- If you need to recreate policies, delete them via Dashboard first:
-- Storage > Policies > course-content > [Policy Name] > Delete
-- ============================================================================

-- Drop existing policies if they exist (for re-runs)
-- ⚠️ These commands will also fail without owner permissions
-- DROP POLICY IF EXISTS "course_content_upload" ON storage.objects;
-- DROP POLICY IF EXISTS "course_content_read" ON storage.objects;
-- DROP POLICY IF EXISTS "course_content_update" ON storage.objects;
-- DROP POLICY IF EXISTS "course_content_delete" ON storage.objects;

-- ============================================================================
-- STORAGE POLICIES
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

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON POLICY "course_content_upload" ON storage.objects IS 'Allows uploads to institute-specific paths. Teachers can only upload to assigned courses.';
COMMENT ON POLICY "course_content_read" ON storage.objects IS 'Allows reads from institute-specific paths. Students can only read from enrolled batches.';
COMMENT ON POLICY "course_content_update" ON storage.objects IS 'Allows updates to institute-specific paths. Teachers can only update assigned courses.';
COMMENT ON POLICY "course_content_delete" ON storage.objects IS 'Allows deletes from institute-specific paths. Teachers can only delete from assigned courses.';

