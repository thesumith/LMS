# Storage Policies - Quick Setup Guide

## ⚠️ Important

**Storage policies CANNOT be created via SQL directly.** They require owner-level permissions that are not available through regular SQL execution.

**You MUST use the Supabase Dashboard to create these policies.**

## Step-by-Step Instructions

### Prerequisites

1. Ensure the `course-content` bucket exists (create via Dashboard if needed)
2. Have admin access to your Supabase project

### Step 1: Navigate to Storage Policies

1. Go to your Supabase project dashboard
2. Click **Storage** in the left sidebar
3. Click on the **`course-content`** bucket
4. Click the **Policies** tab
5. Click **New Policy**

### Step 2: Create Upload Policy

**Policy Settings:**
- **Policy name:** `course_content_upload`
- **Allowed operation:** `INSERT`
- **Target roles:** `authenticated`

**Policy definition** (copy from `supabase/storage/policies-dashboard.sql` - Policy 1):
```sql
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
```

Click **Review** then **Save policy**

### Step 3: Create Read Policy

**Policy Settings:**
- **Policy name:** `course_content_read`
- **Allowed operation:** `SELECT`
- **Target roles:** `authenticated`

**Policy definition** (copy from `supabase/storage/policies-dashboard.sql` - Policy 2):
```sql
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
```

Click **Review** then **Save policy**

### Step 4: Create Update Policy

**Policy Settings:**
- **Policy name:** `course_content_update`
- **Allowed operation:** `UPDATE`
- **Target roles:** `authenticated`

**USING clause** (copy from `supabase/storage/policies-dashboard.sql` - Policy 3):
```sql
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
```

**WITH CHECK clause:** Use the same expression as USING clause

Click **Review** then **Save policy**

### Step 5: Create Delete Policy

**Policy Settings:**
- **Policy name:** `course_content_delete`
- **Allowed operation:** `DELETE`
- **Target roles:** `authenticated`

**Policy definition** (copy from `supabase/storage/policies-dashboard.sql` - Policy 4):
```sql
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
```

Click **Review** then **Save policy**

## Verification

After creating all policies, verify they work:

1. **Test as Teacher:**
   - Try uploading a file to `institute/{your-institute-id}/courses/{course-id}/lessons/{lesson-id}/test.pdf`
   - Should succeed if teacher is assigned to the course

2. **Test as Student:**
   - Try generating a signed URL for a file in an enrolled batch
   - Should succeed if student is enrolled in the batch

## Troubleshooting

### Policy Creation Fails in Dashboard

- Ensure you're using the correct bucket name: `course-content`
- Check that helper functions exist: `is_super_admin()`, `has_role()`, `get_user_institute_id()`
- Verify RLS helper functions are created (from migration `002_rls_policies.sql`)

### Policies Don't Work

- Check that user has the correct role assigned
- Verify institute_id matches in the path
- Ensure batch_teachers or batch_students records exist
- Check that records are not soft-deleted

## Files Reference

- **Dashboard-ready policies:** `supabase/storage/policies-dashboard.sql`
- **Full SQL reference:** `supabase/storage/policies.sql`
- **Detailed instructions:** `docs/STORAGE_SETUP_INSTRUCTIONS.md`

