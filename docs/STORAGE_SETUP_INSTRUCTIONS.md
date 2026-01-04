# Supabase Storage Setup Instructions

## Overview

Storage policies in Supabase require elevated permissions (service role key) to create. This document provides instructions for setting up storage buckets and policies.

## Option 1: Using Supabase Dashboard (Recommended)

### Step 1: Create Storage Bucket

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the sidebar
3. Click **New bucket**
4. Configure:
   - **Name:** `course-content`
   - **Public:** `false` (Private bucket)
   - **File size limit:** `100 MB`
   - **Allowed MIME types:** 
     - `video/mp4`
     - `video/webm`
     - `video/quicktime`
     - `application/pdf`
     - `application/vnd.ms-powerpoint`
     - `application/vnd.openxmlformats-officedocument.presentationml.presentation`

### Step 2: Create Storage Policies

1. Go to **Storage** > **Policies**
2. Select the `course-content` bucket
3. Click **New Policy**
4. For each policy below, create a new policy:

#### Upload Policy

**Policy Name:** `course_content_upload`

**Allowed Operation:** `INSERT`

**Policy Definition:**
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

#### Read Policy

**Policy Name:** `course_content_read`

**Allowed Operation:** `SELECT`

**Policy Definition:**
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

#### Update Policy

**Policy Name:** `course_content_update`

**Allowed Operation:** `UPDATE`

**Policy Definition:**
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

#### Delete Policy

**Policy Name:** `course_content_delete`

**Allowed Operation:** `DELETE`

**Policy Definition:**
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

## Option 2: Using SQL with Service Role Key

If you have access to the service role key, you can run the SQL directly:

1. Connect to your Supabase database using the **service role key** (not anon key)
2. Run the SQL from `supabase/storage/setup.sql`

**Important:** Never expose the service role key in client-side code or commit it to version control.

### Using Supabase CLI

```bash
# Set service role key as environment variable
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Run the SQL file
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/storage/setup.sql
```

### Using Supabase SQL Editor

1. Go to **SQL Editor** in Supabase Dashboard
2. Make sure you're connected with appropriate permissions
3. Copy and paste the contents of `supabase/storage/setup.sql`
4. Run the query

## Verification

After setting up policies, verify they work:

1. **Test Upload (as Teacher):**
   ```typescript
   const { data, error } = await supabase.storage
     .from('course-content')
     .upload('institute/[institute-id]/courses/[course-id]/lessons/[lesson-id]/test.pdf', file);
   ```

2. **Test Read (as Student):**
   ```typescript
   const { data, error } = await supabase.storage
     .from('course-content')
     .createSignedUrl('institute/[institute-id]/courses/[course-id]/lessons/[lesson-id]/test.pdf', 3600);
   ```

## Troubleshooting

### Error: "must be owner of relation objects"

**Solution:** This means you don't have sufficient permissions. Use one of:
- Supabase Dashboard (Option 1 - Recommended)
- Service role key (Option 2)
- Contact your database administrator

### Error: "policy already exists"

**Solution:** The DROP POLICY IF EXISTS statements should handle this. If not, manually drop the policy first:
```sql
DROP POLICY "course_content_upload" ON storage.objects;
```

### Policies not working

**Check:**
1. Bucket exists and is private
2. Policies are created on the correct bucket
3. User has the correct role (INSTITUTE_ADMIN, TEACHER, or STUDENT)
4. Path structure matches: `institute/{institute_id}/courses/{course_id}/...`

## Path Structure

Files must be stored in this structure:
```
institute/{institute_id}/courses/{course_id}/lessons/{lesson_id}/{filename}
```

Example:
```
institute/123e4567-e89b-12d3-a456-426614174000/courses/456e7890-e89b-12d3-a456-426614174001/lessons/789e0123-e89b-12d3-a456-426614174002/video.mp4
```

## Security Notes

1. **Bucket is Private:** All files require signed URLs for access
2. **Path-Based Access:** Policies check the file path structure
3. **Role-Based Access:** Different roles have different access levels
4. **RLS Enforcement:** Policies work with database RLS for complete security

## Related Files

- `supabase/storage/setup.sql` - SQL for bucket and policies
- `lib/storage/content.ts` - Storage utility functions
- `docs/CONTENT_MANAGEMENT.md` - Content management documentation

