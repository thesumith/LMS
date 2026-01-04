# Course Content Management - Implementation Guide

## Overview

This document describes the implementation of course content management with Modules, Lessons, and secure file storage using Supabase Storage.

## Architecture

### Content Hierarchy

```
Course
  └── Module (ordered)
      └── Lesson (ordered)
          ├── Video (stored in Supabase Storage)
          ├── PDF (stored in Supabase Storage)
          ├── PPT (stored in Supabase Storage)
          ├── Link (external URL)
          └── Text (stored in database)
```

### Storage Structure

**Path Format:**
```
institute/{institute_id}/courses/{course_id}/lessons/{lesson_id}/{filename}
```

**Example:**
```
institute/123e4567-e89b-12d3-a456-426614174000/courses/456e7890-e89b-12d3-a456-426614174001/lessons/789e0123-e89b-12d3-a456-426614174002/video.mp4
```

## Data Model

### Modules Table

**Fields:**
- `id` (UUID) - Primary key
- `institute_id` (UUID) - Foreign key to institutes
- `course_id` (UUID) - Foreign key to courses
- `name` (VARCHAR) - Module name
- `description` (TEXT) - Module description
- `sequence` (INTEGER) - Order within course (unique per course)
- `is_active` (BOOLEAN) - Active status
- `created_at`, `updated_at`, `deleted_at` - Timestamps

**Constraints:**
- Sequence must be unique per course
- Sequence must be positive

### Lessons Table

**Fields:**
- `id` (UUID) - Primary key
- `institute_id` (UUID) - Foreign key to institutes
- `course_id` (UUID) - Foreign key to courses
- `module_id` (UUID) - Foreign key to modules
- `title` (VARCHAR) - Lesson title
- `description` (TEXT) - Lesson description
- `content_type` (VARCHAR) - Type: 'video', 'pdf', 'ppt', 'link', 'text'
- `content_url` (TEXT) - External URL (for link type)
- `storage_path` (TEXT) - Path in Supabase Storage (for file types)
- `sequence` (INTEGER) - Order within module (unique per module)
- `duration_minutes` (INTEGER) - Duration (for video type)
- `is_active` (BOOLEAN) - Active status
- `created_at`, `updated_at`, `deleted_at` - Timestamps

**Constraints:**
- Sequence must be unique per module
- Sequence must be positive
- Content type validation:
  - `link` → `content_url` required
  - `video`, `pdf`, `ppt` → `storage_path` required
  - `text` → neither required (content in description)

## Row Level Security (RLS)

### Modules Policies

#### SELECT
- **SUPER_ADMIN:** All active modules
- **INSTITUTE_ADMIN:** All modules in their institute
- **TEACHER:** Modules for courses they are assigned to
- **STUDENT:** Modules for courses in batches they are enrolled in

#### INSERT/UPDATE/DELETE
- **SUPER_ADMIN:** All modules
- **INSTITUTE_ADMIN:** Modules in their institute
- **TEACHER:** Modules for courses they are assigned to

### Lessons Policies

#### SELECT
- **SUPER_ADMIN:** All active lessons
- **INSTITUTE_ADMIN:** All lessons in their institute
- **TEACHER:** Lessons for courses they are assigned to
- **STUDENT:** Lessons for courses in batches they are enrolled in

#### INSERT/UPDATE/DELETE
- **SUPER_ADMIN:** All lessons
- **INSTITUTE_ADMIN:** Lessons in their institute
- **TEACHER:** Lessons for courses they are assigned to

## Supabase Storage

### Bucket Configuration

**Bucket Name:** `course-content`

**Settings:**
- **Public:** `false` (private bucket)
- **File Size Limit:** 100MB
- **Allowed MIME Types:**
  - Video: `video/mp4`, `video/webm`, `video/quicktime`
  - PDF: `application/pdf`
  - PPT: `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`

### Storage Policies

#### Upload Policy
- **SUPER_ADMIN:** Can upload anywhere
- **INSTITUTE_ADMIN:** Can upload to their institute's path
- **TEACHER:** Can upload to courses they are assigned to

#### Read Policy
- **SUPER_ADMIN:** Can read from anywhere
- **INSTITUTE_ADMIN:** Can read from their institute's path
- **TEACHER:** Can read from courses they are assigned to
- **STUDENT:** Can read from courses in batches they are enrolled in

#### Update/Delete Policy
- **SUPER_ADMIN:** Can update/delete anywhere
- **INSTITUTE_ADMIN:** Can update/delete in their institute's path
- **TEACHER:** Can update/delete in courses they are assigned to

### Signed URL Generation

**Strategy:**
1. Files are stored in private bucket
2. Signed URLs are generated on-demand
3. URLs expire after specified time (default: 1 hour)
4. RLS policies enforce access control before URL generation

**Implementation:**
```typescript
const { url } = await getSignedUrl(storagePath, 3600); // 1 hour expiry
```

## API Endpoints

### Modules

#### `POST /api/institute/courses/[courseId]/modules`

Create a new module.

**Request:**
```json
{
  "name": "Introduction to Programming",
  "description": "Basic programming concepts",
  "sequence": 1,
  "isActive": true
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "institute_id": "uuid",
    "course_id": "uuid",
    "name": "Introduction to Programming",
    "sequence": 1,
    "is_active": true,
    ...
  }
}
```

#### `GET /api/institute/courses/[courseId]/modules`

List all modules in a course.

**Query Parameters:**
- `active` (boolean) - Filter by active status

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Introduction to Programming",
      "sequence": 1,
      "courses": {
        "id": "uuid",
        "name": "CS101",
        "code": "CS101"
      }
    }
  ]
}
```

### Lessons

#### `POST /api/institute/modules/[moduleId]/lessons`

Create a new lesson (supports file upload).

**Request (Form Data):**
```
title: "Variables and Data Types"
description: "Learn about variables"
contentType: "video"
sequence: 1
durationMinutes: 15
file: [File]
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Variables and Data Types",
    "content_type": "video",
    "storage_path": "institute/.../lessons/.../video.mp4",
    "sequence": 1,
    ...
  }
}
```

#### `GET /api/institute/modules/[moduleId]/lessons`

List all lessons in a module.

**Query Parameters:**
- `active` (boolean) - Filter by active status
- `includeSignedUrls` (boolean) - Include signed URLs for file-based content

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Variables and Data Types",
      "content_type": "video",
      "storage_path": "institute/.../video.mp4",
      "signed_url": "https://...", // if includeSignedUrls=true
      "modules": {
        "id": "uuid",
        "name": "Introduction to Programming"
      }
    }
  ]
}
```

### Lesson Content

#### `GET /api/institute/lessons/[lessonId]/content`

Get lesson content with signed URL.

**Query Parameters:**
- `expiresIn` (number) - URL expiration time in seconds (default: 3600)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Variables and Data Types",
    "content_type": "video",
    "signed_url": "https://...",
    "modules": {...},
    "courses": {...}
  }
}
```

## Content Access Flow

### Teacher Uploads Content

```
Teacher → POST /api/institute/modules/[moduleId]/lessons
    ↓
Validate teacher is assigned to course (RLS)
    ↓
Upload file to Supabase Storage
    ↓
Storage policy validates path (institute/courses/{course_id}/...)
    ↓
Create lesson record with storage_path
    ↓
Return lesson data
```

### Student Views Content

```
Student → GET /api/institute/lessons/[lessonId]/content
    ↓
Validate student is enrolled in batch (RLS)
    ↓
Fetch lesson data
    ↓
Generate signed URL for storage_path
    ↓
Storage policy validates access (institute/courses/{course_id}/...)
    ↓
Return lesson with signed URL
```

## Security Considerations

### 1. **Private Storage Bucket**

**Enforcement:**
- Bucket is set to `public: false`
- All files require signed URLs for access
- No direct public URLs

### 2. **Path-Based Access Control**

**Enforcement:**
- Storage policies check path structure
- Teachers can only upload to assigned courses
- Students can only read from enrolled batches

### 3. **RLS Enforcement**

**Enforcement:**
- Database RLS filters lessons/modules by access
- Storage policies enforce file access
- Both must pass for content access

### 4. **Signed URL Expiration**

**Enforcement:**
- URLs expire after specified time (default: 1 hour)
- Prevents long-term URL sharing
- New URLs must be generated for continued access

## File Upload Strategy

### 1. **Client Upload Flow**

```typescript
// Client-side upload
const formData = new FormData();
formData.append('file', file);
formData.append('title', 'Lesson Title');
formData.append('contentType', 'video');
formData.append('sequence', '1');

const response = await fetch('/api/institute/modules/[moduleId]/lessons', {
  method: 'POST',
  body: formData,
});
```

### 2. **Server-Side Processing**

```typescript
// Server receives form data
const file = formData.get('file') as File;

// Generate storage path
const storagePath = generateStoragePath(
  instituteId,
  courseId,
  moduleId,
  file.name
);

// Upload to Supabase Storage
await uploadContentFile(file, storagePath, file.type);

// Create lesson record
await createLesson({ storage_path: storagePath, ... });
```

## Signed URL Generation Strategy

### On-Demand Generation

**When:** Student requests lesson content

**How:**
1. Fetch lesson from database (RLS validates access)
2. If `storage_path` exists, generate signed URL
3. Return lesson with signed URL

**Expiration:** Configurable (default: 1 hour)

### Batch Generation

**When:** Loading multiple lessons (e.g., module view)

**How:**
```typescript
const lessons = await getLessons(moduleId);
const storagePaths = lessons
  .filter(l => l.storage_path)
  .map(l => l.storage_path);

const urlMap = await getBatchSignedUrls(storagePaths, 3600);
```

**Benefits:** Reduces API calls, improves performance

## Edge Cases

### 1. **File Upload Fails After Lesson Creation**

**Handling:**
- Lesson creation is rolled back
- Uploaded file is deleted
- Error returned to client

### 2. **Signed URL Generation Fails**

**Handling:**
- Error is logged but request doesn't fail
- Lesson data is returned without signed URL
- Client can retry URL generation

### 3. **Teacher Removed from Batch**

**Handling:**
- RLS immediately blocks access to modules/lessons
- Storage policies block file access
- Content remains but teacher cannot access

### 4. **Student Drops from Batch**

**Handling:**
- Enrollment status changes to 'dropped'
- RLS blocks access to lessons
- Storage policies block file access

## Performance Optimizations

### 1. **Indexes**

- `course_id` index for module lookups
- `module_id` index for lesson lookups
- `sequence` composite indexes for ordering
- Partial indexes exclude soft-deleted rows

### 2. **Signed URL Caching**

- Cache signed URLs on client-side
- Regenerate only when expired
- Batch generate for multiple lessons

### 3. **File Size Limits**

- 100MB limit per file
- Prevents storage abuse
- Enforced at bucket level

## Testing Scenarios

### Test 1: Teacher Uploads Video

1. Authenticate as Teacher assigned to batch
2. POST lesson with video file
3. Verify file uploaded to correct path
4. Verify lesson created with storage_path

### Test 2: Student Views Lesson

1. Authenticate as Student enrolled in batch
2. GET lesson content
3. Verify signed URL generated
4. Verify URL allows file access

### Test 3: Teacher Removed from Batch

1. Remove teacher from batch
2. Try to access module/lesson
3. Verify RLS blocks access
4. Verify storage policy blocks file access

### Test 4: Cross-Institute Access

1. Authenticate as Teacher from Institute A
2. Try to access content from Institute B
3. Verify RLS blocks access
4. Verify storage policy blocks file access

## Related Files

- `supabase/migrations/005_content_structure.sql` - Table definitions
- `supabase/migrations/006_content_rls_policies.sql` - RLS policies
- `supabase/storage/setup.sql` - Storage bucket and policies
- `app/api/institute/courses/[courseId]/modules/route.ts` - Modules API
- `app/api/institute/modules/[moduleId]/lessons/route.ts` - Lessons API
- `app/api/institute/lessons/[lessonId]/content/route.ts` - Content access API
- `lib/storage/content.ts` - Storage utilities

## Next Steps

1. **Add Content Versioning:** Track content changes over time
2. **Add Content Analytics:** Track student engagement with content
3. **Add Content Preview:** Generate thumbnails for videos
4. **Add Content Transcoding:** Convert videos to multiple formats
5. **Add Content Download:** Allow offline content access

