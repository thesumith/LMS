-- ============================================================================
-- Storage Policies - FOR SUPABASE DASHBOARD USE ONLY
-- ============================================================================
-- These policies MUST be created via Supabase Dashboard.
-- They cannot be run as SQL directly (requires owner permissions).
--
-- Instructions:
-- 1. Go to Supabase Dashboard > Storage > Policies
-- 2. Select 'course-content' bucket
-- 3. Click "New Policy"
-- 4. For each policy below, copy the policy definition
-- 5. Paste into the "Policy definition" field
-- ============================================================================

-- ============================================================================
-- POLICY 1: Upload (INSERT)
-- ============================================================================
-- Policy Name: course_content_upload
-- Allowed Operation: INSERT
-- Target Roles: authenticated
--
-- Copy this into "Policy definition" field:
-- ============================================================================
(
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

-- ============================================================================
-- POLICY 2: Read (SELECT)
-- ============================================================================
-- Policy Name: course_content_read
-- Allowed Operation: SELECT
-- Target Roles: authenticated
--
-- Copy this into "Policy definition" field:
-- ============================================================================
(
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
    OR
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
)

-- ============================================================================
-- POLICY 3: Update (UPDATE)
-- ============================================================================
-- Policy Name: course_content_update
-- Allowed Operation: UPDATE
-- Target Roles: authenticated
--
-- Copy this into "Policy definition" field (USING clause):
-- ============================================================================
(
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

-- Note: For UPDATE policy, use the same expression for both USING and WITH CHECK

-- ============================================================================
-- POLICY 4: Delete (DELETE)
-- ============================================================================
-- Policy Name: course_content_delete
-- Allowed Operation: DELETE
-- Target Roles: authenticated
--
-- Copy this into "Policy definition" field:
-- ============================================================================
(
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

