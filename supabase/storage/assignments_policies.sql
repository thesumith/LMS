-- ============================================================================
-- Supabase Storage Policies for Assignment Submissions
-- ============================================================================
-- This script adds storage policies for assignment submissions
-- All files are private - access via signed URLs only
-- ============================================================================

-- Note: This assumes the 'course-content' bucket exists
-- If using a separate bucket for assignments, create it first:
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--     'assignments',
--     'assignments',
--     false,
--     10485760, -- 10MB limit for assignments
--     ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
-- );

-- ============================================================================
-- STORAGE POLICIES FOR ASSIGNMENT SUBMISSIONS
-- ============================================================================
-- Path structure: institute/{institute_id}/assignments/{assignment_id}/submissions/{student_id}/{filename}
-- ============================================================================

-- Policy: Allow authenticated users to upload submission files
CREATE POLICY "assignment_submissions_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'course-content' -- Or 'assignments' if using separate bucket
    AND (
        -- SUPER_ADMIN can upload anywhere
        is_super_admin()
        OR
        -- INSTITUTE_ADMIN can upload to their institute's path
        (has_role('INSTITUTE_ADMIN') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'assignments')
        OR
        -- STUDENT can upload to their own submission path
        (has_role('STUDENT') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'assignments'
            AND (storage.foldername(name))[5] = auth.uid()::text
            -- Verify assignment belongs to enrolled batch
            AND (storage.foldername(name))[4] IN (
                SELECT a.id::text
                FROM assignments a
                INNER JOIN batch_students bs ON a.batch_id = bs.batch_id
                WHERE bs.student_id = auth.uid()
                    AND bs.status = 'active'
                    AND a.deleted_at IS NULL
                    AND bs.deleted_at IS NULL
            ))
    )
);

-- Policy: Allow authenticated users to read submission files
CREATE POLICY "assignment_submissions_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'course-content' -- Or 'assignments' if using separate bucket
    AND (
        -- SUPER_ADMIN can read from anywhere
        is_super_admin()
        OR
        -- INSTITUTE_ADMIN can read from their institute's path
        (has_role('INSTITUTE_ADMIN') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'assignments')
        OR
        -- TEACHER can read submissions for batches they are assigned to
        (has_role('TEACHER') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'assignments'
            AND (storage.foldername(name))[4] IN (
                SELECT a.id::text
                FROM assignments a
                INNER JOIN batch_teachers bt ON a.batch_id = bt.batch_id
                WHERE bt.teacher_id = auth.uid()
                    AND a.deleted_at IS NULL
                    AND bt.deleted_at IS NULL
            ))
        OR
        -- STUDENT can read their own submissions
        (has_role('STUDENT') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'assignments'
            AND (storage.foldername(name))[5] = auth.uid()::text)
    )
);

-- Policy: Allow authenticated users to update submission files (teachers for evaluation notes, etc.)
CREATE POLICY "assignment_submissions_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'course-content' -- Or 'assignments' if using separate bucket
    AND (
        is_super_admin()
        OR
        (has_role('INSTITUTE_ADMIN') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'assignments')
        OR
        -- TEACHER can update submissions for batches they are assigned to
        (has_role('TEACHER') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'assignments'
            AND (storage.foldername(name))[4] IN (
                SELECT a.id::text
                FROM assignments a
                INNER JOIN batch_teachers bt ON a.batch_id = bt.batch_id
                WHERE bt.teacher_id = auth.uid()
                    AND a.deleted_at IS NULL
                    AND bt.deleted_at IS NULL
            ))
        -- Students cannot update submissions (immutable)
    )
)
WITH CHECK (
    bucket_id = 'course-content'
    AND (
        is_super_admin()
        OR
        (has_role('INSTITUTE_ADMIN') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'assignments')
        OR
        (has_role('TEACHER') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'assignments'
            AND (storage.foldername(name))[4] IN (
                SELECT a.id::text
                FROM assignments a
                INNER JOIN batch_teachers bt ON a.batch_id = bt.batch_id
                WHERE bt.teacher_id = auth.uid()
                    AND a.deleted_at IS NULL
                    AND bt.deleted_at IS NULL
            ))
    )
);

-- Policy: Allow authenticated users to delete submission files
CREATE POLICY "assignment_submissions_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'course-content' -- Or 'assignments' if using separate bucket
    AND (
        is_super_admin()
        OR
        (has_role('INSTITUTE_ADMIN') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'assignments')
        OR
        -- TEACHER can delete submissions from batches they are assigned to
        (has_role('TEACHER') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'assignments'
            AND (storage.foldername(name))[4] IN (
                SELECT a.id::text
                FROM assignments a
                INNER JOIN batch_teachers bt ON a.batch_id = bt.batch_id
                WHERE bt.teacher_id = auth.uid()
                    AND a.deleted_at IS NULL
                    AND bt.deleted_at IS NULL
            ))
        -- Students cannot delete submissions
    )
);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON POLICY "assignment_submissions_upload" ON storage.objects IS 'Students can upload submissions to their own path. Teachers/Admin can upload to institute paths.';
COMMENT ON POLICY "assignment_submissions_read" ON storage.objects IS 'Students can read their own submissions. Teachers can read submissions for their batches.';
COMMENT ON POLICY "assignment_submissions_update" ON storage.objects IS 'Teachers can update submissions for their batches. Students cannot update (immutable).';
COMMENT ON POLICY "assignment_submissions_delete" ON storage.objects IS 'Teachers can delete submissions from their batches. Students cannot delete.';

