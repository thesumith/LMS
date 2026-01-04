# ✅ Storage Setup Complete!

## Summary

All storage buckets and policies have been successfully applied to your Supabase project.

## What Was Set Up

### 1. Storage Bucket
- **Bucket Name:** `course-content`
- **Type:** Private (not publicly accessible)
- **File Size Limit:** 100 MB
- **Allowed MIME Types:**
  - Videos: `video/mp4`, `video/webm`, `video/quicktime`
  - Documents: `application/pdf`
  - Word: `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - PowerPoint: `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`

### 2. Storage Policies Applied

#### Course Content Policies
- ✅ `course_content_upload` - Upload policy for course content
- ✅ `course_content_read` - Read policy for course content
- ✅ `course_content_update` - Update policy for course content
- ✅ `course_content_delete` - Delete policy for course content

#### Assignment Submission Policies
- ✅ `assignment_submissions_upload` - Students can upload submissions
- ✅ `assignment_submissions_read` - Teachers/Students can read submissions
- ✅ `assignment_submissions_update` - Teachers can update submissions
- ✅ `assignment_submissions_delete` - Teachers can delete submissions

#### Certificate Policies
- ✅ `certificates_upload` - Institute Admin can upload certificates
- ✅ `certificates_read` - Students/Teachers can read certificates
- ✅ `certificates_update` - Institute Admin can update certificates
- ✅ `certificates_delete` - Institute Admin can delete certificates

## Path Structure

### Course Content
```
institute/{institute_id}/courses/{course_id}/lessons/{lesson_id}/{filename}
```

### Assignment Submissions
```
institute/{institute_id}/assignments/{assignment_id}/submissions/{student_id}/{filename}
```

### Certificates
```
institute/{institute_id}/certificates/{certificate_number}.pdf
```

## Access Control

### Super Admin
- ✅ Full access to all storage paths

### Institute Admin
- ✅ Can manage all files in their institute's paths
- ✅ Can upload/read/update/delete certificates

### Teachers
- ✅ Can upload/read/update/delete content for assigned courses
- ✅ Can read assignment submissions for their batches
- ✅ Can read certificates for their batches

### Students
- ✅ Can read content for enrolled batches
- ✅ Can upload assignment submissions to their own path
- ✅ Can read their own assignment submissions
- ✅ Can read their own certificates

## Verification

To verify storage setup:

1. **Check Bucket:**
   - Go to Supabase Dashboard → Storage
   - Verify `course-content` bucket exists
   - Check it's marked as Private

2. **Check Policies:**
   - Go to Supabase Dashboard → Storage → Policies
   - Select `course-content` bucket
   - Verify all 12 policies are listed

3. **Test Upload:**
   - Try uploading a file via your application
   - Verify path structure is correct
   - Verify access control works

## Next Steps

1. **Test File Upload:**
   - Test course content upload (as Teacher)
   - Test assignment submission (as Student)
   - Test certificate generation (as Admin)

2. **Verify Access:**
   - Test signed URL generation
   - Verify students can only access their own files
   - Verify teachers can only access assigned courses

3. **Monitor Usage:**
   - Check storage usage in Supabase Dashboard
   - Set up alerts if needed
   - Monitor file sizes

## Troubleshooting

### Issue: "Permission denied" when uploading
- **Solution:** Check user has correct role and institute assignment
- **Verify:** RLS policies are active and user role is correct

### Issue: "Bucket not found"
- **Solution:** Verify bucket `course-content` exists in Storage dashboard
- **Fix:** Re-run migration `017_storage_setup.sql` if needed

### Issue: "Policy not found"
- **Solution:** Check policies exist in Storage → Policies
- **Fix:** Re-run migration `018_storage_policies_additional.sql` if needed

## Files Applied

- ✅ `017_storage_setup.sql` - Bucket creation and course content policies
- ✅ `018_storage_policies_additional.sql` - Assignment and certificate policies

## Migration Status

All storage migrations have been successfully applied to your Supabase project.

