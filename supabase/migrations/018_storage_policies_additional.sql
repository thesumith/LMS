supabase/storage/assignments_policies.sql:-- ============================================================================
supabase/storage/assignments_policies.sql:-- Supabase Storage Policies for Assignment Submissions
supabase/storage/assignments_policies.sql:-- ============================================================================
supabase/storage/assignments_policies.sql:-- This script adds storage policies for assignment submissions
supabase/storage/assignments_policies.sql:-- All files are private - access via signed URLs only
supabase/storage/assignments_policies.sql:-- ============================================================================
supabase/storage/assignments_policies.sql:
supabase/storage/assignments_policies.sql:-- Note: This assumes the 'course-content' bucket exists
supabase/storage/assignments_policies.sql:-- If using a separate bucket for assignments, create it first:
supabase/storage/assignments_policies.sql:-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
supabase/storage/assignments_policies.sql:-- VALUES (
supabase/storage/assignments_policies.sql:--     'assignments',
supabase/storage/assignments_policies.sql:--     'assignments',
supabase/storage/assignments_policies.sql:--     false,
supabase/storage/assignments_policies.sql:--     10485760, -- 10MB limit for assignments
supabase/storage/assignments_policies.sql:--     ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
supabase/storage/assignments_policies.sql:-- );
supabase/storage/assignments_policies.sql:
supabase/storage/assignments_policies.sql:-- ============================================================================
supabase/storage/assignments_policies.sql:-- STORAGE POLICIES FOR ASSIGNMENT SUBMISSIONS
supabase/storage/assignments_policies.sql:-- ============================================================================
supabase/storage/assignments_policies.sql:-- Path structure: institute/{institute_id}/assignments/{assignment_id}/submissions/{student_id}/{filename}
supabase/storage/assignments_policies.sql:-- ============================================================================
supabase/storage/assignments_policies.sql:
supabase/storage/assignments_policies.sql:-- Policy: Allow authenticated users to upload submission files
supabase/storage/assignments_policies.sql:CREATE POLICY "assignment_submissions_upload"
supabase/storage/assignments_policies.sql:ON storage.objects
supabase/storage/assignments_policies.sql:FOR INSERT
supabase/storage/assignments_policies.sql:TO authenticated
supabase/storage/assignments_policies.sql:WITH CHECK (
supabase/storage/assignments_policies.sql:    bucket_id = 'course-content' -- Or 'assignments' if using separate bucket
supabase/storage/assignments_policies.sql:    AND (
supabase/storage/assignments_policies.sql:        -- SUPER_ADMIN can upload anywhere
supabase/storage/assignments_policies.sql:        is_super_admin()
supabase/storage/assignments_policies.sql:        OR
supabase/storage/assignments_policies.sql:        -- INSTITUTE_ADMIN can upload to their institute's path
supabase/storage/assignments_policies.sql:        (has_role('INSTITUTE_ADMIN') 
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[3] = 'assignments')
supabase/storage/assignments_policies.sql:        OR
supabase/storage/assignments_policies.sql:        -- STUDENT can upload to their own submission path
supabase/storage/assignments_policies.sql:        (has_role('STUDENT') 
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[3] = 'assignments'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[5] = auth.uid()::text
supabase/storage/assignments_policies.sql:            -- Verify assignment belongs to enrolled batch
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[4] IN (
supabase/storage/assignments_policies.sql:                SELECT a.id::text
supabase/storage/assignments_policies.sql:                FROM assignments a
supabase/storage/assignments_policies.sql:                INNER JOIN batch_students bs ON a.batch_id = bs.batch_id
supabase/storage/assignments_policies.sql:                WHERE bs.student_id = auth.uid()
supabase/storage/assignments_policies.sql:                    AND bs.status = 'active'
supabase/storage/assignments_policies.sql:                    AND a.deleted_at IS NULL
supabase/storage/assignments_policies.sql:                    AND bs.deleted_at IS NULL
supabase/storage/assignments_policies.sql:            ))
supabase/storage/assignments_policies.sql:    )
supabase/storage/assignments_policies.sql:);
supabase/storage/assignments_policies.sql:
supabase/storage/assignments_policies.sql:-- Policy: Allow authenticated users to read submission files
supabase/storage/assignments_policies.sql:CREATE POLICY "assignment_submissions_read"
supabase/storage/assignments_policies.sql:ON storage.objects
supabase/storage/assignments_policies.sql:FOR SELECT
supabase/storage/assignments_policies.sql:TO authenticated
supabase/storage/assignments_policies.sql:USING (
supabase/storage/assignments_policies.sql:    bucket_id = 'course-content' -- Or 'assignments' if using separate bucket
supabase/storage/assignments_policies.sql:    AND (
supabase/storage/assignments_policies.sql:        -- SUPER_ADMIN can read from anywhere
supabase/storage/assignments_policies.sql:        is_super_admin()
supabase/storage/assignments_policies.sql:        OR
supabase/storage/assignments_policies.sql:        -- INSTITUTE_ADMIN can read from their institute's path
supabase/storage/assignments_policies.sql:        (has_role('INSTITUTE_ADMIN') 
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[3] = 'assignments')
supabase/storage/assignments_policies.sql:        OR
supabase/storage/assignments_policies.sql:        -- TEACHER can read submissions for batches they are assigned to
supabase/storage/assignments_policies.sql:        (has_role('TEACHER') 
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[3] = 'assignments'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[4] IN (
supabase/storage/assignments_policies.sql:                SELECT a.id::text
supabase/storage/assignments_policies.sql:                FROM assignments a
supabase/storage/assignments_policies.sql:                INNER JOIN batch_teachers bt ON a.batch_id = bt.batch_id
supabase/storage/assignments_policies.sql:                WHERE bt.teacher_id = auth.uid()
supabase/storage/assignments_policies.sql:                    AND a.deleted_at IS NULL
supabase/storage/assignments_policies.sql:                    AND bt.deleted_at IS NULL
supabase/storage/assignments_policies.sql:            ))
supabase/storage/assignments_policies.sql:        OR
supabase/storage/assignments_policies.sql:        -- STUDENT can read their own submissions
supabase/storage/assignments_policies.sql:        (has_role('STUDENT') 
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[3] = 'assignments'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[5] = auth.uid()::text)
supabase/storage/assignments_policies.sql:    )
supabase/storage/assignments_policies.sql:);
supabase/storage/assignments_policies.sql:
supabase/storage/assignments_policies.sql:-- Policy: Allow authenticated users to update submission files (teachers for evaluation notes, etc.)
supabase/storage/assignments_policies.sql:CREATE POLICY "assignment_submissions_update"
supabase/storage/assignments_policies.sql:ON storage.objects
supabase/storage/assignments_policies.sql:FOR UPDATE
supabase/storage/assignments_policies.sql:TO authenticated
supabase/storage/assignments_policies.sql:USING (
supabase/storage/assignments_policies.sql:    bucket_id = 'course-content' -- Or 'assignments' if using separate bucket
supabase/storage/assignments_policies.sql:    AND (
supabase/storage/assignments_policies.sql:        is_super_admin()
supabase/storage/assignments_policies.sql:        OR
supabase/storage/assignments_policies.sql:        (has_role('INSTITUTE_ADMIN') 
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[3] = 'assignments')
supabase/storage/assignments_policies.sql:        OR
supabase/storage/assignments_policies.sql:        -- TEACHER can update submissions for batches they are assigned to
supabase/storage/assignments_policies.sql:        (has_role('TEACHER') 
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[3] = 'assignments'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[4] IN (
supabase/storage/assignments_policies.sql:                SELECT a.id::text
supabase/storage/assignments_policies.sql:                FROM assignments a
supabase/storage/assignments_policies.sql:                INNER JOIN batch_teachers bt ON a.batch_id = bt.batch_id
supabase/storage/assignments_policies.sql:                WHERE bt.teacher_id = auth.uid()
supabase/storage/assignments_policies.sql:                    AND a.deleted_at IS NULL
supabase/storage/assignments_policies.sql:                    AND bt.deleted_at IS NULL
supabase/storage/assignments_policies.sql:            ))
supabase/storage/assignments_policies.sql:        -- Students cannot update submissions (immutable)
supabase/storage/assignments_policies.sql:    )
supabase/storage/assignments_policies.sql:)
supabase/storage/assignments_policies.sql:WITH CHECK (
supabase/storage/assignments_policies.sql:    bucket_id = 'course-content'
supabase/storage/assignments_policies.sql:    AND (
supabase/storage/assignments_policies.sql:        is_super_admin()
supabase/storage/assignments_policies.sql:        OR
supabase/storage/assignments_policies.sql:        (has_role('INSTITUTE_ADMIN') 
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[3] = 'assignments')
supabase/storage/assignments_policies.sql:        OR
supabase/storage/assignments_policies.sql:        (has_role('TEACHER') 
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[3] = 'assignments'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[4] IN (
supabase/storage/assignments_policies.sql:                SELECT a.id::text
supabase/storage/assignments_policies.sql:                FROM assignments a
supabase/storage/assignments_policies.sql:                INNER JOIN batch_teachers bt ON a.batch_id = bt.batch_id
supabase/storage/assignments_policies.sql:                WHERE bt.teacher_id = auth.uid()
supabase/storage/assignments_policies.sql:                    AND a.deleted_at IS NULL
supabase/storage/assignments_policies.sql:                    AND bt.deleted_at IS NULL
supabase/storage/assignments_policies.sql:            ))
supabase/storage/assignments_policies.sql:    )
supabase/storage/assignments_policies.sql:);
supabase/storage/assignments_policies.sql:
supabase/storage/assignments_policies.sql:-- Policy: Allow authenticated users to delete submission files
supabase/storage/assignments_policies.sql:CREATE POLICY "assignment_submissions_delete"
supabase/storage/assignments_policies.sql:ON storage.objects
supabase/storage/assignments_policies.sql:FOR DELETE
supabase/storage/assignments_policies.sql:TO authenticated
supabase/storage/assignments_policies.sql:USING (
supabase/storage/assignments_policies.sql:    bucket_id = 'course-content' -- Or 'assignments' if using separate bucket
supabase/storage/assignments_policies.sql:    AND (
supabase/storage/assignments_policies.sql:        is_super_admin()
supabase/storage/assignments_policies.sql:        OR
supabase/storage/assignments_policies.sql:        (has_role('INSTITUTE_ADMIN') 
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[3] = 'assignments')
supabase/storage/assignments_policies.sql:        OR
supabase/storage/assignments_policies.sql:        -- TEACHER can delete submissions from batches they are assigned to
supabase/storage/assignments_policies.sql:        (has_role('TEACHER') 
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[3] = 'assignments'
supabase/storage/assignments_policies.sql:            AND (storage.foldername(name))[4] IN (
supabase/storage/assignments_policies.sql:                SELECT a.id::text
supabase/storage/assignments_policies.sql:                FROM assignments a
supabase/storage/assignments_policies.sql:                INNER JOIN batch_teachers bt ON a.batch_id = bt.batch_id
supabase/storage/assignments_policies.sql:                WHERE bt.teacher_id = auth.uid()
supabase/storage/assignments_policies.sql:                    AND a.deleted_at IS NULL
supabase/storage/assignments_policies.sql:                    AND bt.deleted_at IS NULL
supabase/storage/assignments_policies.sql:            ))
supabase/storage/assignments_policies.sql:        -- Students cannot delete submissions
supabase/storage/assignments_policies.sql:    )
supabase/storage/assignments_policies.sql:);
supabase/storage/assignments_policies.sql:
supabase/storage/assignments_policies.sql:-- ============================================================================
supabase/storage/assignments_policies.sql:-- COMMENTS FOR DOCUMENTATION
supabase/storage/assignments_policies.sql:-- ============================================================================
supabase/storage/assignments_policies.sql:
supabase/storage/certificates_policies.sql:-- ============================================================================
supabase/storage/certificates_policies.sql:-- Supabase Storage Policies for Certificates
supabase/storage/certificates_policies.sql:-- ============================================================================
supabase/storage/certificates_policies.sql:-- This script adds storage policies for certificate PDFs
supabase/storage/certificates_policies.sql:-- All certificates are private - access via signed URLs only
supabase/storage/certificates_policies.sql:-- ============================================================================
supabase/storage/certificates_policies.sql:
supabase/storage/certificates_policies.sql:-- Note: Using 'course-content' bucket (same as course content)
supabase/storage/certificates_policies.sql:-- If using a separate bucket, create it first:
supabase/storage/certificates_policies.sql:-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
supabase/storage/certificates_policies.sql:-- VALUES (
supabase/storage/certificates_policies.sql:--     'certificates',
supabase/storage/certificates_policies.sql:--     'certificates',
supabase/storage/certificates_policies.sql:--     false,
supabase/storage/certificates_policies.sql:--     5242880, -- 5MB limit for certificates
supabase/storage/certificates_policies.sql:--     ARRAY['application/pdf']
supabase/storage/certificates_policies.sql:-- );
supabase/storage/certificates_policies.sql:
supabase/storage/certificates_policies.sql:-- ============================================================================
supabase/storage/certificates_policies.sql:-- STORAGE POLICIES FOR CERTIFICATES
supabase/storage/certificates_policies.sql:-- ============================================================================
supabase/storage/certificates_policies.sql:-- Path structure: institute/{institute_id}/certificates/{certificate_number}.pdf
supabase/storage/certificates_policies.sql:-- ============================================================================
supabase/storage/certificates_policies.sql:
supabase/storage/certificates_policies.sql:-- Policy: Allow authenticated users to upload certificate PDFs
supabase/storage/certificates_policies.sql:CREATE POLICY "certificates_upload"
supabase/storage/certificates_policies.sql:ON storage.objects
supabase/storage/certificates_policies.sql:FOR INSERT
supabase/storage/certificates_policies.sql:TO authenticated
supabase/storage/certificates_policies.sql:WITH CHECK (
supabase/storage/certificates_policies.sql:    bucket_id = 'course-content' -- Or 'certificates' if using separate bucket
supabase/storage/certificates_policies.sql:    AND (
supabase/storage/certificates_policies.sql:        -- SUPER_ADMIN can upload anywhere
supabase/storage/certificates_policies.sql:        is_super_admin()
supabase/storage/certificates_policies.sql:        OR
supabase/storage/certificates_policies.sql:        -- INSTITUTE_ADMIN can upload to their institute's certificates path
supabase/storage/certificates_policies.sql:        (has_role('INSTITUTE_ADMIN') 
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[3] = 'certificates')
supabase/storage/certificates_policies.sql:        -- System-generated certificates use SECURITY DEFINER function
supabase/storage/certificates_policies.sql:    )
supabase/storage/certificates_policies.sql:);
supabase/storage/certificates_policies.sql:
supabase/storage/certificates_policies.sql:-- Policy: Allow authenticated users to read certificate PDFs
supabase/storage/certificates_policies.sql:CREATE POLICY "certificates_read"
supabase/storage/certificates_policies.sql:ON storage.objects
supabase/storage/certificates_policies.sql:FOR SELECT
supabase/storage/certificates_policies.sql:TO authenticated
supabase/storage/certificates_policies.sql:USING (
supabase/storage/certificates_policies.sql:    bucket_id = 'course-content' -- Or 'certificates' if using separate bucket
supabase/storage/certificates_policies.sql:    AND (
supabase/storage/certificates_policies.sql:        -- SUPER_ADMIN can read from anywhere
supabase/storage/certificates_policies.sql:        is_super_admin()
supabase/storage/certificates_policies.sql:        OR
supabase/storage/certificates_policies.sql:        -- INSTITUTE_ADMIN can read from their institute's certificates path
supabase/storage/certificates_policies.sql:        (has_role('INSTITUTE_ADMIN') 
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[3] = 'certificates')
supabase/storage/certificates_policies.sql:        OR
supabase/storage/certificates_policies.sql:        -- TEACHER can read certificates for batches they are assigned to
supabase/storage/certificates_policies.sql:        (has_role('TEACHER') 
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[3] = 'certificates'
supabase/storage/certificates_policies.sql:            -- Verify certificate belongs to a batch they teach
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[4] IN (
supabase/storage/certificates_policies.sql:                SELECT c.certificate_number || '.pdf'
supabase/storage/certificates_policies.sql:                FROM certificates c
supabase/storage/certificates_policies.sql:                INNER JOIN batch_teachers bt ON c.batch_id = bt.batch_id
supabase/storage/certificates_policies.sql:                WHERE bt.teacher_id = auth.uid()
supabase/storage/certificates_policies.sql:                    AND c.deleted_at IS NULL
supabase/storage/certificates_policies.sql:                    AND bt.deleted_at IS NULL
supabase/storage/certificates_policies.sql:            ))
supabase/storage/certificates_policies.sql:        OR
supabase/storage/certificates_policies.sql:        -- STUDENT can read their own certificates
supabase/storage/certificates_policies.sql:        (has_role('STUDENT') 
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[3] = 'certificates'
supabase/storage/certificates_policies.sql:            -- Verify certificate belongs to them
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[4] IN (
supabase/storage/certificates_policies.sql:                SELECT certificate_number || '.pdf'
supabase/storage/certificates_policies.sql:                FROM certificates
supabase/storage/certificates_policies.sql:                WHERE student_id = auth.uid()
supabase/storage/certificates_policies.sql:                    AND deleted_at IS NULL
supabase/storage/certificates_policies.sql:            ))
supabase/storage/certificates_policies.sql:    )
supabase/storage/certificates_policies.sql:);
supabase/storage/certificates_policies.sql:
supabase/storage/certificates_policies.sql:-- Policy: Allow authenticated users to update certificate PDFs (for reissuing)
supabase/storage/certificates_policies.sql:CREATE POLICY "certificates_update"
supabase/storage/certificates_policies.sql:ON storage.objects
supabase/storage/certificates_policies.sql:FOR UPDATE
supabase/storage/certificates_policies.sql:TO authenticated
supabase/storage/certificates_policies.sql:USING (
supabase/storage/certificates_policies.sql:    bucket_id = 'course-content'
supabase/storage/certificates_policies.sql:    AND (
supabase/storage/certificates_policies.sql:        is_super_admin()
supabase/storage/certificates_policies.sql:        OR
supabase/storage/certificates_policies.sql:        (has_role('INSTITUTE_ADMIN') 
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[3] = 'certificates')
supabase/storage/certificates_policies.sql:    )
supabase/storage/certificates_policies.sql:)
supabase/storage/certificates_policies.sql:WITH CHECK (
supabase/storage/certificates_policies.sql:    bucket_id = 'course-content'
supabase/storage/certificates_policies.sql:    AND (
supabase/storage/certificates_policies.sql:        is_super_admin()
supabase/storage/certificates_policies.sql:        OR
supabase/storage/certificates_policies.sql:        (has_role('INSTITUTE_ADMIN') 
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[3] = 'certificates')
supabase/storage/certificates_policies.sql:    )
supabase/storage/certificates_policies.sql:);
supabase/storage/certificates_policies.sql:
supabase/storage/certificates_policies.sql:-- Policy: Allow authenticated users to delete certificate PDFs
supabase/storage/certificates_policies.sql:CREATE POLICY "certificates_delete"
supabase/storage/certificates_policies.sql:ON storage.objects
supabase/storage/certificates_policies.sql:FOR DELETE
supabase/storage/certificates_policies.sql:TO authenticated
supabase/storage/certificates_policies.sql:USING (
supabase/storage/certificates_policies.sql:    bucket_id = 'course-content' -- Or 'certificates' if using separate bucket
supabase/storage/certificates_policies.sql:    AND (
supabase/storage/certificates_policies.sql:        is_super_admin()
supabase/storage/certificates_policies.sql:        OR
supabase/storage/certificates_policies.sql:        (has_role('INSTITUTE_ADMIN') 
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[1] = 'institute'
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[2] = get_user_institute_id()::text
supabase/storage/certificates_policies.sql:            AND (storage.foldername(name))[3] = 'certificates')
supabase/storage/certificates_policies.sql:    )
supabase/storage/certificates_policies.sql:);
supabase/storage/certificates_policies.sql:
supabase/storage/certificates_policies.sql:-- ============================================================================
supabase/storage/certificates_policies.sql:-- COMMENTS FOR DOCUMENTATION
supabase/storage/certificates_policies.sql:-- ============================================================================
supabase/storage/certificates_policies.sql:
