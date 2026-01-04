# Academic Structure - Implementation Guide

## Overview

This document describes the implementation of Courses, Batches, and Enrollments for the multi-tenant LMS SaaS platform. All data is strictly isolated per institute and access is controlled via Row Level Security (RLS).

## Data Model

### Entity Relationship Diagram

```
institutes
    ↓
courses (1:N)
    ↓
batches (1:N)
    ↓
batch_teachers (N:M) ← profiles (TEACHER)
    ↓
batch_students (N:M) ← profiles (STUDENT)
```

### Tables

#### 1. **courses**

Stores course definitions within an institute.

**Fields:**
- `id` (UUID) - Primary key
- `institute_id` (UUID) - Foreign key to institutes
- `name` (VARCHAR) - Course name
- `code` (VARCHAR) - Course code (unique per institute)
- `description` (TEXT) - Course description
- `is_active` (BOOLEAN) - Active status
- `created_at`, `updated_at`, `deleted_at` - Timestamps

**Constraints:**
- Course code must be unique within an institute
- Soft delete supported

**Indexes:**
- `institute_id` (for tenant filtering)
- `code` (for lookups)
- `is_active` (for filtering active courses)
- Composite: `institute_id + is_active`

#### 2. **batches**

Represents a specific instance of a course with dates.

**Fields:**
- `id` (UUID) - Primary key
- `institute_id` (UUID) - Foreign key to institutes
- `course_id` (UUID) - Foreign key to courses
- `name` (VARCHAR) - Batch name (e.g., "Fall 2024")
- `start_date` (DATE) - Batch start date
- `end_date` (DATE) - Batch end date
- `is_active` (BOOLEAN) - Active status
- `created_at`, `updated_at`, `deleted_at` - Timestamps

**Constraints:**
- `end_date >= start_date`
- Soft delete supported

**Indexes:**
- `institute_id` (for tenant filtering)
- `course_id` (for course lookups)
- `start_date`, `end_date` (for date range queries)
- Composite: `institute_id + course_id`

#### 3. **batch_teachers**

Many-to-many relationship between batches and teachers.

**Fields:**
- `id` (UUID) - Primary key
- `institute_id` (UUID) - Foreign key to institutes
- `batch_id` (UUID) - Foreign key to batches
- `teacher_id` (UUID) - Foreign key to profiles
- `created_at`, `updated_at`, `deleted_at` - Timestamps

**Constraints:**
- Unique: `batch_id + teacher_id` (prevents duplicate assignments)
- Soft delete supported

**Indexes:**
- `institute_id` (for tenant filtering)
- `batch_id` (for batch lookups)
- `teacher_id` (for teacher lookups)
- Composite: `batch_id + teacher_id`

#### 4. **batch_students** (Enrollments)

Represents student enrollment in a batch.

**Fields:**
- `id` (UUID) - Primary key
- `institute_id` (UUID) - Foreign key to institutes
- `batch_id` (UUID) - Foreign key to batches
- `student_id` (UUID) - Foreign key to profiles
- `status` (VARCHAR) - Enrollment status: 'active', 'completed', 'dropped'
- `enrolled_at` (TIMESTAMPTZ) - Enrollment timestamp
- `completed_at` (TIMESTAMPTZ) - Completion timestamp (nullable)
- `dropped_at` (TIMESTAMPTZ) - Drop timestamp (nullable)
- `created_at`, `updated_at`, `deleted_at` - Timestamps

**Constraints:**
- Unique: `batch_id + student_id` (prevents duplicate enrollments)
- Status validation: dates must match status
- Soft delete supported

**Indexes:**
- `institute_id` (for tenant filtering)
- `batch_id` (for batch lookups)
- `student_id` (for student lookups)
- `status` (for filtering by status)
- Composite: `batch_id + student_id`
- Composite: `student_id + status`

## Row Level Security (RLS)

### Courses

**SELECT:**
- SUPER_ADMIN: All active courses
- INSTITUTE_ADMIN: All courses in their institute

**INSERT/UPDATE/DELETE:**
- SUPER_ADMIN: All courses
- INSTITUTE_ADMIN: Courses in their institute

### Batches

**SELECT:**
- SUPER_ADMIN: All active batches
- INSTITUTE_ADMIN: All batches in their institute
- TEACHER: Batches they are assigned to
- STUDENT: Batches they are enrolled in

**INSERT/UPDATE/DELETE:**
- SUPER_ADMIN: All batches
- INSTITUTE_ADMIN: Batches in their institute

### Batch Teachers

**SELECT:**
- SUPER_ADMIN: All active assignments
- INSTITUTE_ADMIN: All assignments in their institute
- TEACHER: Their own assignments

**INSERT/UPDATE/DELETE:**
- SUPER_ADMIN: All assignments
- INSTITUTE_ADMIN: Assignments in their institute

### Batch Students (Enrollments)

**SELECT:**
- SUPER_ADMIN: All active enrollments
- INSTITUTE_ADMIN: All enrollments in their institute
- TEACHER: Enrollments in batches they teach
- STUDENT: Their own enrollments

**INSERT/DELETE:**
- SUPER_ADMIN: All enrollments
- INSTITUTE_ADMIN: Enrollments in their institute

**UPDATE:**
- SUPER_ADMIN: All enrollments
- INSTITUTE_ADMIN: Enrollments in their institute
- TEACHER: Enrollments in batches they teach (can update status)

## API Endpoints

### Courses

#### `POST /api/institute/courses`

Create a new course.

**Request:**
```json
{
  "name": "Introduction to Computer Science",
  "code": "CS101",
  "description": "Basic programming concepts",
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
    "name": "Introduction to Computer Science",
    "code": "CS101",
    "description": "Basic programming concepts",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "deleted_at": null
  }
}
```

#### `GET /api/institute/courses`

List all courses in the institute.

**Query Parameters:**
- `active` (boolean) - Filter by active status

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Introduction to Computer Science",
      "code": "CS101",
      ...
    }
  ]
}
```

### Batches

#### `POST /api/institute/batches`

Create a new batch.

**Request:**
```json
{
  "courseId": "uuid",
  "name": "Fall 2024",
  "startDate": "2024-09-01",
  "endDate": "2024-12-15",
  "teacherIds": ["uuid1", "uuid2"],
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
    "name": "Fall 2024",
    "start_date": "2024-09-01",
    "end_date": "2024-12-15",
    "courses": {
      "name": "Introduction to Computer Science",
      "code": "CS101"
    }
  }
}
```

#### `GET /api/institute/batches`

List batches (filtered by role via RLS).

**Query Parameters:**
- `courseId` (UUID) - Filter by course
- `active` (boolean) - Filter by active status

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Fall 2024",
      "courses": {
        "name": "Introduction to Computer Science",
        "code": "CS101"
      },
      "batch_teachers": [
        {
          "teacher_id": "uuid",
          "profiles": {
            "id": "uuid",
            "email": "teacher@example.com",
            "first_name": "John",
            "last_name": "Doe"
          }
        }
      ]
    }
  ]
}
```

### Enrollments

#### `POST /api/institute/enrollments`

Enroll a student into a batch.

**Request:**
```json
{
  "batchId": "uuid",
  "studentId": "uuid"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "batch_id": "uuid",
    "student_id": "uuid",
    "status": "active",
    "enrolled_at": "2024-01-01T00:00:00Z",
    "batches": {
      "id": "uuid",
      "name": "Fall 2024",
      "courses": {
        "name": "Introduction to Computer Science",
        "code": "CS101"
      }
    },
    "profiles": {
      "id": "uuid",
      "email": "student@example.com",
      "first_name": "Jane",
      "last_name": "Smith"
    }
  }
}
```

#### `GET /api/institute/enrollments`

List enrollments (filtered by role via RLS).

**Query Parameters:**
- `batchId` (UUID) - Filter by batch
- `studentId` (UUID) - Filter by student
- `status` (string) - Filter by status: 'active', 'completed', 'dropped'

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "status": "active",
      "batches": {...},
      "profiles": {...}
    }
  ]
}
```

#### `PATCH /api/institute/enrollments`

Update enrollment status.

**Request:**
```json
{
  "enrollmentId": "uuid",
  "status": "completed"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "completed",
    "completed_at": "2024-12-15T00:00:00Z",
    ...
  }
}
```

## Data Flow

### 1. Institute Admin Creates Course

```
Institute Admin → POST /api/institute/courses
    ↓
Middleware validates institute context
    ↓
RLS enforces INSTITUTE_ADMIN role
    ↓
Create course in database
    ↓
Return course data
```

### 2. Institute Admin Creates Batch

```
Institute Admin → POST /api/institute/batches
    ↓
Validate course exists and belongs to institute
    ↓
Create batch
    ↓
Assign teachers (if provided)
    ↓
Validate teachers belong to institute and have TEACHER role
    ↓
Create batch_teachers records
    ↓
Return batch with course and teacher info
```

### 3. Institute Admin Enrolls Student

```
Institute Admin → POST /api/institute/enrollments
    ↓
Validate batch exists and belongs to institute
    ↓
Validate student exists, belongs to institute, has STUDENT role
    ↓
Check for existing enrollment
    ↓
Create batch_students record
    ↓
Return enrollment with batch and student info
```

### 4. Teacher Views Batches

```
Teacher → GET /api/institute/batches
    ↓
RLS automatically filters to batches where:
    batch_id IN (
      SELECT batch_id 
      FROM batch_teachers 
      WHERE teacher_id = auth.uid()
    )
    ↓
Return only assigned batches
```

### 5. Student Views Enrollments

```
Student → GET /api/institute/enrollments
    ↓
RLS automatically filters to enrollments where:
    student_id = auth.uid()
    ↓
Return only their own enrollments
```

### 6. Teacher Updates Enrollment Status

```
Teacher → PATCH /api/institute/enrollments
    ↓
RLS validates teacher is assigned to batch
    ↓
Update enrollment status
    ↓
Set status-specific timestamps (completed_at, dropped_at)
    ↓
Return updated enrollment
```

## Security Considerations

### 1. Institute Isolation

**Enforcement:**
- All tables include `institute_id`
- RLS policies filter by `institute_id = get_user_institute_id()`
- Cross-institute access is impossible (except SUPER_ADMIN)

### 2. Role-Based Access

**Enforcement:**
- RLS policies check user roles from database
- Not based on JWT claims alone
- Roles verified via `user_roles` table

### 3. Data Validation

**Enforcement:**
- API routes validate institute context from headers (set by middleware)
- Never trust `institute_id` from request body
- Always use `x-institute-id` header from middleware

### 4. Referential Integrity

**Enforcement:**
- Foreign keys ensure data consistency
- Cascade deletes for batch_teachers and batch_students
- Restrict deletes for courses and batches (prevents orphaned data)

## Performance Optimizations

### Indexes

All tables have strategic indexes:
- `institute_id` for tenant filtering
- Foreign keys for joins
- Composite indexes for common query patterns
- Partial indexes (WHERE deleted_at IS NULL) for active records

### Query Optimization

- RLS policies use indexed columns
- Partial indexes exclude soft-deleted rows
- Composite indexes support multi-column filters

## Testing Scenarios

### Test 1: Institute Admin Creates Course

1. Authenticate as Institute Admin
2. POST `/api/institute/courses` with course data
3. Verify course created with correct `institute_id`
4. Verify course code is unique within institute

### Test 2: Teacher Views Only Assigned Batches

1. Authenticate as Teacher
2. GET `/api/institute/batches`
3. Verify only batches with `batch_teachers` record are returned
4. Verify batches from other institutes are not returned

### Test 3: Student Views Only Own Enrollments

1. Authenticate as Student
2. GET `/api/institute/enrollments`
3. Verify only enrollments with `student_id = auth.uid()` are returned
4. Verify enrollments from other students are not returned

### Test 4: Cross-Institute Access Prevention

1. Authenticate as Institute A Admin
2. Try to access Institute B's courses
3. Verify RLS blocks access (returns empty or error)

### Test 5: Teacher Updates Enrollment Status

1. Authenticate as Teacher assigned to batch
2. PATCH `/api/institute/enrollments` to update status
3. Verify status updated correctly
4. Verify timestamps set appropriately

## Related Files

- `supabase/migrations/003_academic_structure.sql` - Table definitions
- `supabase/migrations/004_academic_rls_policies.sql` - RLS policies
- `app/api/institute/courses/route.ts` - Courses API
- `app/api/institute/batches/route.ts` - Batches API
- `app/api/institute/enrollments/route.ts` - Enrollments API

## Next Steps

1. **Add Course Prerequisites:** Many-to-many relationship for course prerequisites
2. **Add Batch Capacity:** Limit number of students per batch
3. **Add Enrollment Waitlist:** Queue for full batches
4. **Add Attendance Tracking:** Track student attendance per batch
5. **Add Grades:** Link grades to enrollments
6. **Add Assignments:** Link assignments to batches

