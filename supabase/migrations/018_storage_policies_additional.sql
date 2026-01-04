-- ============================================================================
-- Supabase Storage Policies for Assignment Submissions and Certificates
-- ============================================================================
-- This migration adds storage policies for assignments and certificates
-- All files are private - access via signed URLs only
-- ============================================================================

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
    bucket_id = 'course-content'
    AND (
        is_super_admin()
        OR
        (has_role('INSTITUTE_ADMIN') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'assignments')
        OR
        (has_role('STUDENT') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'assignments'
            AND (storage.foldername(name))[5] = auth.uid()::text
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
        OR
        (has_role('STUDENT') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'assignments'
            AND (storage.foldername(name))[5] = auth.uid()::text)
    )
);

-- Policy: Allow authenticated users to update submission files
CREATE POLICY "assignment_submissions_update"
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

-- ============================================================================
-- STORAGE POLICIES FOR CERTIFICATES
-- ============================================================================
-- Path structure: institute/{institute_id}/certificates/{certificate_number}.pdf
-- ============================================================================

-- Policy: Allow authenticated users to upload certificate PDFs
CREATE POLICY "certificates_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'course-content'
    AND (
        is_super_admin()
        OR
        (has_role('INSTITUTE_ADMIN') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'certificates')
    )
);

-- Policy: Allow authenticated users to read certificate PDFs
CREATE POLICY "certificates_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'course-content'
    AND (
        is_super_admin()
        OR
        (has_role('INSTITUTE_ADMIN') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'certificates')
        OR
        (has_role('TEACHER') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'certificates'
            AND (storage.foldername(name))[4] IN (
                SELECT c.certificate_number || '.pdf'
                FROM certificates c
                INNER JOIN batch_teachers bt ON c.batch_id = bt.batch_id
                WHERE bt.teacher_id = auth.uid()
                    AND c.deleted_at IS NULL
                    AND bt.deleted_at IS NULL
            ))
        OR
        (has_role('STUDENT') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'certificates'
            AND (storage.foldername(name))[4] IN (
                SELECT certificate_number || '.pdf'
                FROM certificates
                WHERE student_id = auth.uid()
                    AND deleted_at IS NULL
            ))
    )
);

-- Policy: Allow authenticated users to update certificate PDFs
CREATE POLICY "certificates_update"
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
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'certificates')
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
            AND (storage.foldername(name))[3] = 'certificates')
    )
);

-- Policy: Allow authenticated users to delete certificate PDFs
CREATE POLICY "certificates_delete"
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
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'certificates')
    )
);
