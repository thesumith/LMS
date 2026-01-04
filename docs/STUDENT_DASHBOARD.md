# Student Dashboard - Implementation Guide

## Overview

This document describes the implementation of the student-facing dashboard with lesson progress tracking in the multi-tenant LMS SaaS.

## Architecture

### Student Dashboard Flow

```
Student → GET /api/student/dashboard
    ↓
RLS filters to student's enrollments
    ↓
Fetch enrolled batches with course info
    ↓
Calculate progress for each batch/course
    ↓
Return dashboard data with progress percentages
```

### Progress Tracking Flow

```
Student → POST /api/student/progress
    ↓
Validate student is enrolled in batch
    ↓
Validate lesson belongs to course
    ↓
Create or update progress record
    ↓
Trigger prevents updating if already completed
    ↓
Return progress data
```

## Data Model

### lesson_progress Table

**Fields:**
- `id` (UUID) - Primary key
- `institute_id` (UUID) - Foreign key to institutes
- `student_id` (UUID) - Foreign key to profiles
- `lesson_id` (UUID) - Foreign key to lessons
- `batch_id` (UUID) - Foreign key to batches
- `course_id` (UUID) - Foreign key to courses
- `started_at` (TIMESTAMPTZ) - When student first accessed lesson
- `last_viewed_at` (TIMESTAMPTZ) - Last time student viewed lesson
- `completed_at` (TIMESTAMPTZ) - When lesson was completed (nullable)
- `progress_percentage` (INTEGER) - Progress 0-100
- `created_at`, `updated_at`, `deleted_at` - Timestamps

**Constraints:**
- Unique: `student_id + lesson_id + batch_id` (prevents duplicates)
- Completion check: If `completed_at` is set, `progress_percentage` must be 100
- Immutability: Once `completed_at` is set, progress cannot be updated (enforced by trigger)

**Indexes:**
- `student_id` - For student progress lookups
- `lesson_id` - For lesson progress lookups
- `batch_id` - For batch progress lookups
- `course_id` - For course progress lookups
- Composite: `student_id + batch_id` - For batch progress
- Composite: `student_id + course_id` - For course progress

## Row Level Security (RLS)

### SELECT Policy

**Access:**
- **SUPER_ADMIN:** All active progress
- **INSTITUTE_ADMIN:** All progress in their institute
- **TEACHER:** Progress of students in batches they teach
- **STUDENT:** Only their own progress

**Enforcement:**
```sql
-- Students can only see their own progress
student_id = auth.uid()
```

### INSERT Policy

**Access:**
- **SUPER_ADMIN:** Can create any progress
- **INSTITUTE_ADMIN:** Can create progress for students in their institute
- **STUDENT:** Can create their own progress records

**Validation:**
- Student must be enrolled in the batch (status = 'active')
- Lesson must belong to a module in the course

### UPDATE Policy

**Access:**
- **SUPER_ADMIN:** Can update any progress
- **INSTITUTE_ADMIN:** Can update progress in their institute
- **STUDENT:** Can update their own progress

**Immutability:**
- Trigger prevents updating if `completed_at` is already set
- If marking as complete, automatically sets `progress_percentage = 100`

### DELETE Policy

**Access:**
- **SUPER_ADMIN:** Can delete any progress
- **INSTITUTE_ADMIN:** Can delete progress in their institute
- **STUDENT:** Can delete their own progress (soft delete)

## Progress Calculation

### Database Function

**Function:** `calculate_course_progress(student_id, course_id, batch_id)`

**Returns:**
- `total_lessons` - Total lessons in course
- `completed_lessons` - Lessons completed by student
- `progress_percentage` - Percentage completed

**Implementation:**
```sql
SELECT 
    COUNT(*) as total_lessons,
    COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as completed_lessons,
    ROUND((COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) as progress_percentage
FROM lesson_progress
WHERE student_id = $student_id
    AND course_id = $course_id
    AND batch_id = $batch_id;
```

## API Endpoints

### Student Dashboard

#### `GET /api/student/dashboard`

Get student dashboard data.

**Query Parameters:**
- `active` (boolean) - Filter by active batches only

**Response (200):**
```json
{
  "success": true,
  "data": {
    "batches": [
      {
        "id": "uuid",
        "name": "Fall 2024",
        "start_date": "2024-09-01",
        "end_date": "2024-12-15",
        "is_active": true,
        "course": {
          "id": "uuid",
          "name": "Introduction to Computer Science",
          "code": "CS101"
        },
        "teachers": [
          {
            "id": "uuid",
            "email": "teacher@example.com",
            "first_name": "John",
            "last_name": "Doe"
          }
        ],
        "enrollment": {
          "status": "active",
          "enrolled_at": "2024-09-01T00:00:00Z"
        },
        "progress": {
          "totalLessons": 20,
          "completedLessons": 15,
          "progressPercentage": 75.0
        }
      }
    ],
    "summary": {
      "totalBatches": 3,
      "activeBatches": 2,
      "totalCourses": 2,
      "averageProgress": 65.5
    }
  }
}
```

### Progress Tracking

#### `POST /api/student/progress`

Create or update lesson progress.

**Request:**
```json
{
  "lessonId": "uuid",
  "batchId": "uuid",
  "progressPercentage": 50,
  "markComplete": false
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "student_id": "uuid",
    "lesson_id": "uuid",
    "batch_id": "uuid",
    "course_id": "uuid",
    "progress_percentage": 50,
    "started_at": "2024-09-01T00:00:00Z",
    "last_viewed_at": "2024-09-01T10:00:00Z",
    "completed_at": null,
    "lessons": {
      "title": "Variables and Data Types",
      "content_type": "video"
    },
    "batches": {
      "name": "Fall 2024"
    },
    "courses": {
      "name": "CS101",
      "code": "CS101"
    }
  }
}
```

**Mark Complete:**
```json
{
  "lessonId": "uuid",
  "batchId": "uuid",
  "markComplete": true
}
```

#### `GET /api/student/progress`

Get student progress.

**Query Parameters:**
- `batchId` (UUID) - Filter by batch
- `courseId` (UUID) - Filter by course
- `lessonId` (UUID) - Filter by lesson
- `includeCompleted` (boolean) - Include completed lessons (default: true)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "lesson_id": "uuid",
      "progress_percentage": 100,
      "completed_at": "2024-09-01T12:00:00Z",
      "lessons": {
        "title": "Variables and Data Types",
        "content_type": "video"
      }
    }
  ]
}
```

## Server Components

### Student Dashboard Page

**File:** `app/student/dashboard/page.tsx`

**Features:**
- Displays enrolled batches
- Shows course information
- Displays progress percentage per batch
- Shows assigned teachers
- Summary statistics

**Usage:**
```typescript
import { getStudentDashboard } from '@/lib/data/student-dashboard';

export default async function StudentDashboardPage() {
  const data = await getStudentDashboard();
  // RLS automatically filters to student's enrollments
  return <Dashboard data={data} />;
}
```

## Edge Cases

### 1. Content Updated After Progress

**Scenario:** Lesson content is updated after student has progress.

**Handling:**
- Progress record remains valid
- `last_viewed_at` can be updated
- If not completed, student can continue from where they left off
- If completed, progress remains immutable

### 2. Lesson Removed from Module

**Scenario:** Lesson is soft-deleted from module.

**Handling:**
- Progress record remains (soft delete cascade)
- Progress is excluded from calculations (WHERE deleted_at IS NULL)
- Student can no longer access the lesson
- Historical progress is preserved

### 3. Student Drops from Batch

**Scenario:** Student enrollment status changes to 'dropped'.

**Handling:**
- Progress records remain
- RLS blocks access to lessons
- Progress calculations exclude dropped enrollments
- Historical progress is preserved

### 4. Batch Completed

**Scenario:** Batch end date has passed.

**Handling:**
- Progress records remain
- Student can still view completed lessons
- Progress calculations continue to work
- Historical progress is preserved

### 5. Attempting to Update Completed Progress

**Scenario:** Student tries to update progress that's already marked complete.

**Handling:**
- Trigger throws exception
- API returns validation error
- Progress remains immutable
- Error message: "Cannot update completed progress"

## Security Considerations

### 1. **Student Isolation**

**Enforcement:**
- RLS ensures students can only see their own progress
- `student_id = auth.uid()` in all policies
- Cross-student access is impossible

### 2. **Progress Immutability**

**Enforcement:**
- Database trigger prevents updating completed progress
- API validates before update
- `completed_at` cannot be cleared once set

### 3. **Enrollment Validation**

**Enforcement:**
- Progress can only be created for enrolled batches
- Status must be 'active'
- Lesson must belong to course in batch

### 4. **Teacher Access**

**Enforcement:**
- Teachers can only see progress of students in their batches
- RLS filters by `batch_teachers` relationship
- Cross-institute access blocked

## Performance Optimizations

### 1. **Indexes**

- Strategic indexes on foreign keys
- Composite indexes for common queries
- Partial indexes exclude soft-deleted rows

### 2. **Progress Calculation**

- Database function for efficient calculation
- Cached on dashboard load
- Recalculated on progress update

### 3. **Batch Queries**

- Fetch all batches in single query
- Calculate progress in parallel
- Minimize database round trips

## Testing Scenarios

### Test 1: Student Views Dashboard

1. Authenticate as Student
2. GET `/api/student/dashboard`
3. Verify only enrolled batches are returned
4. Verify progress percentages are calculated correctly

### Test 2: Student Tracks Progress

1. Authenticate as Student
2. POST `/api/student/progress` with progress data
3. Verify progress record created
4. Update progress
5. Verify progress updated correctly

### Test 3: Student Marks Lesson Complete

1. Authenticate as Student
2. POST `/api/student/progress` with `markComplete: true`
3. Verify `completed_at` is set
4. Verify `progress_percentage` is 100
5. Try to update progress
6. Verify update is blocked (immutable)

### Test 4: Teacher Views Student Progress

1. Authenticate as Teacher
2. GET progress for student in assigned batch
3. Verify progress is visible
4. Try to access progress for student in different batch
5. Verify access is blocked

### Test 5: Cross-Student Access Prevention

1. Authenticate as Student A
2. Try to access progress for Student B
3. Verify RLS blocks access
4. Verify empty result or error

## Related Files

- `supabase/migrations/007_lesson_progress.sql` - Table definition
- `supabase/migrations/008_lesson_progress_rls.sql` - RLS policies
- `app/api/student/dashboard/route.ts` - Dashboard API
- `app/api/student/progress/route.ts` - Progress tracking API
- `lib/data/student-dashboard.ts` - Server component helpers
- `app/student/dashboard/page.tsx` - Dashboard page component

## Next Steps

1. **Add Progress Analytics:** Detailed progress reports for teachers
2. **Add Progress Notifications:** Notify students of incomplete lessons
3. **Add Progress Export:** Allow students to export progress reports
4. **Add Time Tracking:** Track time spent on each lesson
5. **Add Progress Goals:** Set and track progress goals

