-- ============================================================================
-- Supabase Storage Policies for Certificates
-- ============================================================================
-- This script adds storage policies for certificate PDFs
-- All certificates are private - access via signed URLs only
-- ============================================================================

-- Note: Using 'course-content' bucket (same as course content)
-- If using a separate bucket, create it first:
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--     'certificates',
--     'certificates',
--     false,
--     5242880, -- 5MB limit for certificates
--     ARRAY['application/pdf']
-- );

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
    bucket_id = 'course-content' -- Or 'certificates' if using separate bucket
    AND (
        -- SUPER_ADMIN can upload anywhere
        is_super_admin()
        OR
        -- INSTITUTE_ADMIN can upload to their institute's certificates path
        (has_role('INSTITUTE_ADMIN') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'certificates')
        -- System-generated certificates use SECURITY DEFINER function
    )
);

-- Policy: Allow authenticated users to read certificate PDFs
CREATE POLICY "certificates_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'course-content' -- Or 'certificates' if using separate bucket
    AND (
        -- SUPER_ADMIN can read from anywhere
        is_super_admin()
        OR
        -- INSTITUTE_ADMIN can read from their institute's certificates path
        (has_role('INSTITUTE_ADMIN') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'certificates')
        OR
        -- TEACHER can read certificates for batches they are assigned to
        (has_role('TEACHER') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'certificates'
            -- Verify certificate belongs to a batch they teach
            AND (storage.foldername(name))[4] IN (
                SELECT c.certificate_number || '.pdf'
                FROM certificates c
                INNER JOIN batch_teachers bt ON c.batch_id = bt.batch_id
                WHERE bt.teacher_id = auth.uid()
                    AND c.deleted_at IS NULL
                    AND bt.deleted_at IS NULL
            ))
        OR
        -- STUDENT can read their own certificates
        (has_role('STUDENT') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'certificates'
            -- Verify certificate belongs to them
            AND (storage.foldername(name))[4] IN (
                SELECT certificate_number || '.pdf'
                FROM certificates
                WHERE student_id = auth.uid()
                    AND deleted_at IS NULL
            ))
    )
);

-- Policy: Allow authenticated users to update certificate PDFs (for reissuing)
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
    bucket_id = 'course-content' -- Or 'certificates' if using separate bucket
    AND (
        is_super_admin()
        OR
        (has_role('INSTITUTE_ADMIN') 
            AND (storage.foldername(name))[1] = 'institute'
            AND (storage.foldername(name))[2] = get_user_institute_id()::text
            AND (storage.foldername(name))[3] = 'certificates')
    )
);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON POLICY "certificates_upload" ON storage.objects IS 'Institute Admin can upload certificates. System can upload via SECURITY DEFINER function.';
COMMENT ON POLICY "certificates_read" ON storage.objects IS 'Students can read their own certificates. Teachers can read certificates for their batches.';
COMMENT ON POLICY "certificates_update" ON storage.objects IS 'Institute Admin can update certificates (for reissuing).';
COMMENT ON POLICY "certificates_delete" ON storage.objects IS 'Institute Admin can delete certificates.';

