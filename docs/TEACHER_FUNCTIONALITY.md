# Teacher Functionality - Implementation Guide

## Overview

This document describes the implementation of teacher-specific functionality in the multi-tenant LMS SaaS, including teacher assignment management and the teacher dashboard.

## Architecture

### Teacher Assignment Flow

```
Institute Admin → POST /api/institute/batches/[batchId]/teachers
    ↓
Validate batch exists and belongs to institute
    ↓
Validate teachers exist, belong to institute, have TEACHER role
    ↓
Check for existing assignments (avoid duplicates)
    ↓
Create batch_teachers records
    ↓
RLS enforces Institute Admin requirement
```

### Teacher Dashboard Flow

```
Teacher → GET /api/teacher/dashboard
    ↓
RLS automatically filters to batches where:
    batch_id IN (
      SELECT batch_id 
      FROM batch_teachers 
      WHERE teacher_id = auth.uid()
    )
    ↓
Fetch course details for each batch
    ↓
Calculate student counts per batch
    ↓
Return dashboard data
```

## RLS Policies

### Batch Teachers Table

#### SELECT Policy

**Policy:** `batch_teachers_select`

**Access:**
- SUPER_ADMIN: All active assignments
- INSTITUTE_ADMIN: All assignments in their institute
- TEACHER: Only their own assignments

**SQL:**
```sql
CREATE POLICY "batch_teachers_select"
ON batch_teachers
FOR SELECT
USING (
    (is_super_admin() AND deleted_at IS NULL)
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id() 
        AND deleted_at IS NULL)
    OR
    (has_role('TEACHER') 
        AND teacher_id = auth.uid()
        AND deleted_at IS NULL)
);
```

**Enforcement:**
- Teachers can only see assignments where `teacher_id = auth.uid()`
- Cross-institute access is impossible
- Soft-deleted assignments are invisible

#### INSERT Policy

**Policy:** `batch_teachers_insert_admin`

**Access:**
- SUPER_ADMIN: Can assign any teacher
- INSTITUTE_ADMIN: Can assign teachers in their institute

**SQL:**
```sql
CREATE POLICY "batch_teachers_insert_admin"
ON batch_teachers
FOR INSERT
WITH CHECK (
    is_super_admin()
    OR
    (has_role('INSTITUTE_ADMIN') 
        AND institute_id = get_user_institute_id()
        AND batch_id IN (
            SELECT id 
            FROM batches 
            WHERE institute_id = get_user_institute_id()
                AND deleted_at IS NULL
        )
        AND teacher_id IN (
            SELECT p.id 
            FROM profiles p
            JOIN user_roles ur ON p.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE p.institute_id = get_user_institute_id()
                AND r.name = 'TEACHER'
                AND p.deleted_at IS NULL
                AND ur.deleted_at IS NULL
        ))
);
```

**Enforcement:**
- Teachers **cannot** insert assignments (read-only access)
- Only Institute Admin can assign teachers
- Validates teacher belongs to institute and has TEACHER role

#### DELETE Policy

**Policy:** `batch_teachers_delete_admin`

**Access:**
- SUPER_ADMIN: Can remove any assignment
- INSTITUTE_ADMIN: Can remove assignments in their institute

**Enforcement:**
- Teachers **cannot** delete assignments
- Soft delete only (sets `deleted_at`)

### Batches Table (Teacher View)

#### SELECT Policy

**Policy:** `batches_select`

**Access for Teachers:**
```sql
(has_role('TEACHER') 
    AND institute_id = get_user_institute_id()
    AND id IN (
        SELECT batch_id 
        FROM batch_teachers 
        WHERE teacher_id = auth.uid()
            AND deleted_at IS NULL
    )
    AND deleted_at IS NULL)
```

**Enforcement:**
- Teachers only see batches where they have an active assignment
- Cross-institute batches are invisible
- Soft-deleted batches are invisible

### Batch Students Table (Teacher View)

#### SELECT Policy

**Policy:** `batch_students_select`

**Access for Teachers:**
```sql
(has_role('TEACHER') 
    AND institute_id = get_user_institute_id()
    AND batch_id IN (
        SELECT batch_id 
        FROM batch_teachers 
        WHERE teacher_id = auth.uid()
            AND deleted_at IS NULL
    )
    AND deleted_at IS NULL)
```

**Enforcement:**
- Teachers only see students in batches they teach
- Cannot see students from other batches
- Cannot see students from other institutes

#### UPDATE Policy

**Policy:** `batch_students_update`

**Access for Teachers:**
```sql
(has_role('TEACHER') 
    AND institute_id = get_user_institute_id()
    AND batch_id IN (
        SELECT batch_id 
        FROM batch_teachers 
        WHERE teacher_id = auth.uid()
            AND deleted_at IS NULL
    ))
```

**Enforcement:**
- Teachers can update enrollment status (active → completed/dropped)
- Cannot update other fields
- Cannot update enrollments in batches they don't teach

## API Endpoints

### Teacher Assignment (Admin Only)

#### `POST /api/institute/batches/[batchId]/teachers`

Assign teachers to a batch.

**Request:**
```json
{
  "teacherIds": ["uuid1", "uuid2"]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Assigned 2 teacher(s) to batch",
  "data": [
    {
      "id": "uuid",
      "batch_id": "uuid",
      "teacher_id": "uuid1",
      "profiles": {
        "id": "uuid1",
        "email": "teacher1@example.com",
        "first_name": "John",
        "last_name": "Doe"
      }
    }
  ]
}
```

**Validation:**
- Batch must exist and belong to institute
- All teachers must exist, belong to institute, have TEACHER role
- Duplicate assignments are skipped (not an error)

#### `GET /api/institute/batches/[batchId]/teachers`

Get all teachers assigned to a batch.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "teacher_id": "uuid1",
      "profiles": {
        "id": "uuid1",
        "email": "teacher1@example.com",
        "first_name": "John",
        "last_name": "Doe"
      }
    }
  ]
}
```

**Access:**
- Institute Admin: All teachers
- Teacher: Only if assigned to batch (RLS enforced)

#### `DELETE /api/institute/batches/[batchId]/teachers?teacherIds=uuid1,uuid2`

Remove teachers from a batch (soft delete).

**Response (200):**
```json
{
  "success": true,
  "message": "Removed 2 teacher(s) from batch",
  "data": [...]
}
```

### Teacher Dashboard

#### `GET /api/teacher/dashboard`

Get teacher dashboard data.

**Query Parameters:**
- `batchId` (optional) - Filter to specific batch
- `includeStudents` (optional) - Include full student details

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
        "courses": {
          "id": "uuid",
          "name": "Introduction to Computer Science",
          "code": "CS101",
          "description": "..."
        },
        "studentCount": 25,
        "activeStudentCount": 23,
        "students": [...] // if includeStudents=true
      }
    ],
    "summary": {
      "totalBatches": 5,
      "activeBatches": 4,
      "totalStudents": 120,
      "activeStudents": 115
    }
  }
}
```

**Access:**
- Teachers only (RLS enforced)
- Only shows batches where teacher is assigned

#### `GET /api/teacher/batches/[batchId]/students`

Get students enrolled in a batch.

**Query Parameters:**
- `status` (optional) - Filter by status: 'active', 'completed', 'dropped'

**Response (200):**
```json
{
  "success": true,
  "data": {
    "batch": {
      "id": "uuid",
      "name": "Fall 2024",
      "courses": {
        "name": "Introduction to Computer Science",
        "code": "CS101"
      }
    },
    "students": [
      {
        "id": "uuid",
        "student_id": "uuid",
        "status": "active",
        "enrolled_at": "2024-09-01T00:00:00Z",
        "profiles": {
          "id": "uuid",
          "email": "student@example.com",
          "first_name": "Jane",
          "last_name": "Smith"
        }
      }
    ],
    "statistics": {
      "total": 25,
      "active": 23,
      "completed": 1,
      "dropped": 1
    }
  }
}
```

**Access:**
- Teachers assigned to batch only (RLS enforced)

## Server Components

### Teacher Dashboard Component

**File:** `app/teacher/dashboard/page.tsx` (example)

```typescript
import { getTeacherDashboard } from '@/lib/data/teacher-dashboard';

export default async function TeacherDashboardPage() {
  const dashboardData = await getTeacherDashboard();

  return (
    <div>
      <h1>My Batches</h1>
      <div>
        <p>Total Batches: {dashboardData.summary.totalBatches}</p>
        <p>Active Students: {dashboardData.summary.activeStudents}</p>
      </div>
      {dashboardData.batches.map((batch) => (
        <div key={batch.id}>
          <h2>{batch.course.name} - {batch.name}</h2>
          <p>Students: {batch.active_student_count} / {batch.student_count}</p>
        </div>
      ))}
    </div>
  );
}
```

### Batch Students Component

**File:** `app/teacher/batches/[batchId]/students/page.tsx` (example)

```typescript
import { getBatchStudents } from '@/lib/data/teacher-dashboard';

export default async function BatchStudentsPage({
  params,
}: {
  params: { batchId: string };
}) {
  const students = await getBatchStudents(params.batchId, 'active');

  return (
    <div>
      <h1>Students</h1>
      {students.map((student: any) => (
        <div key={student.id}>
          <p>{student.profiles.first_name} {student.profiles.last_name}</p>
          <p>{student.profiles.email}</p>
        </div>
      ))}
    </div>
  );
}
```

## SQL Queries for Teacher Dashboard

### Query 1: Get Assigned Batches

```sql
SELECT 
  b.id,
  b.name,
  b.start_date,
  b.end_date,
  b.is_active,
  c.id as course_id,
  c.name as course_name,
  c.code as course_code,
  c.description as course_description
FROM batches b
INNER JOIN batch_teachers bt ON b.id = bt.batch_id
INNER JOIN courses c ON b.course_id = c.id
WHERE bt.teacher_id = auth.uid()
  AND b.institute_id = get_user_institute_id()
  AND b.deleted_at IS NULL
  AND bt.deleted_at IS NULL
  AND c.deleted_at IS NULL
ORDER BY b.start_date DESC;
```

**RLS Enforcement:**
- Automatically filtered by `batch_teachers.teacher_id = auth.uid()`
- Only shows batches where teacher is assigned

### Query 2: Get Student Counts per Batch

```sql
SELECT 
  bs.batch_id,
  COUNT(*) as total_students,
  COUNT(*) FILTER (WHERE bs.status = 'active') as active_students
FROM batch_students bs
INNER JOIN batch_teachers bt ON bs.batch_id = bt.batch_id
WHERE bt.teacher_id = auth.uid()
  AND bs.institute_id = get_user_institute_id()
  AND bs.deleted_at IS NULL
  AND bt.deleted_at IS NULL
GROUP BY bs.batch_id;
```

**RLS Enforcement:**
- Only counts students in batches where teacher is assigned
- Cross-institute students are excluded

### Query 3: Get Students for a Batch

```sql
SELECT 
  bs.id,
  bs.student_id,
  bs.status,
  bs.enrolled_at,
  p.email,
  p.first_name,
  p.last_name
FROM batch_students bs
INNER JOIN batch_teachers bt ON bs.batch_id = bt.batch_id
INNER JOIN profiles p ON bs.student_id = p.id
WHERE bs.batch_id = $batchId
  AND bt.teacher_id = auth.uid()
  AND bs.institute_id = get_user_institute_id()
  AND bs.deleted_at IS NULL
  AND bt.deleted_at IS NULL
ORDER BY bs.enrolled_at DESC;
```

**RLS Enforcement:**
- Only returns students if teacher is assigned to batch
- Returns empty result if teacher not assigned

## Edge Cases

### 1. Teacher Removed from Batch

**Scenario:** Institute Admin removes teacher from batch.

**Behavior:**
- Teacher assignment is soft-deleted (`deleted_at` is set)
- RLS policies filter out soft-deleted assignments
- Teacher immediately loses access to batch
- Teacher can no longer see batch in dashboard
- Teacher can no longer see students in that batch

**Implementation:**
```typescript
// Admin removes teacher
await supabaseAdmin
  .from('batch_teachers')
  .update({ deleted_at: new Date().toISOString() })
  .eq('batch_id', batchId)
  .eq('teacher_id', teacherId);

// Teacher's next query automatically excludes this batch
// RLS policy: WHERE deleted_at IS NULL
```

### 2. Teacher Tries to Access Unassigned Batch

**Scenario:** Teacher tries to access batch they're not assigned to.

**Behavior:**
- RLS policy blocks access
- Query returns empty result or error
- API returns 403 Forbidden

**RLS Enforcement:**
```sql
-- Teacher's query
SELECT * FROM batches WHERE id = $batchId;

-- RLS automatically adds:
AND id IN (
  SELECT batch_id 
  FROM batch_teachers 
  WHERE teacher_id = auth.uid()
    AND deleted_at IS NULL
)

-- If teacher not assigned, result is empty
```

### 3. Multiple Teachers Assigned to Same Batch

**Scenario:** Batch has multiple teachers.

**Behavior:**
- All teachers can see the batch
- All teachers can see all students
- All teachers can update enrollment status
- No data isolation between teachers

**Implementation:**
- RLS allows all assigned teachers equal access
- No additional filtering needed

### 4. Teacher Assigned to Multiple Batches

**Scenario:** Teacher teaches multiple batches.

**Behavior:**
- Teacher sees all assigned batches in dashboard
- Can switch between batches
- Each batch shows its own students

**Implementation:**
- Dashboard query returns all batches where teacher is assigned
- No special handling needed

## Security Considerations

### 1. Role Verification

**Enforcement:**
- RLS policies check roles from database (`user_roles` table)
- Not based on JWT claims alone
- Roles verified on every query

### 2. Institute Isolation

**Enforcement:**
- All queries filter by `institute_id`
- Teachers cannot access batches from other institutes
- Cross-institute access is impossible

### 3. Assignment Verification

**Enforcement:**
- Teachers can only see batches where `batch_teachers.teacher_id = auth.uid()`
- Soft-deleted assignments are invisible
- No way to bypass assignment requirement

### 4. Read-Only Access

**Enforcement:**
- Teachers cannot create/delete courses
- Teachers cannot enroll students
- Teachers cannot assign themselves to batches
- Teachers can only update enrollment status (not create/delete)

## Testing Scenarios

### Test 1: Teacher Assignment

1. Authenticate as Institute Admin
2. POST `/api/institute/batches/[batchId]/teachers` with teacher IDs
3. Verify teachers assigned
4. Verify duplicate assignments are skipped

### Test 2: Teacher Dashboard

1. Authenticate as Teacher
2. GET `/api/teacher/dashboard`
3. Verify only assigned batches are returned
4. Verify student counts are correct

### Test 3: Teacher Removed from Batch

1. Assign teacher to batch
2. Verify teacher can see batch
3. Remove teacher from batch (soft delete)
4. Verify teacher can no longer see batch

### Test 4: Cross-Institute Access Prevention

1. Authenticate as Teacher from Institute A
2. Try to access batch from Institute B
3. Verify RLS blocks access (empty result or error)

### Test 5: Teacher Cannot Assign Themselves

1. Authenticate as Teacher
2. Try to POST to `/api/institute/batches/[batchId]/teachers`
3. Verify RLS blocks insert (403 Forbidden)

## Related Files

- `app/api/institute/batches/[batchId]/teachers/route.ts` - Teacher assignment API
- `app/api/teacher/dashboard/route.ts` - Teacher dashboard API
- `app/api/teacher/batches/[batchId]/students/route.ts` - Batch students API
- `lib/data/teacher-dashboard.ts` - Server component data fetching
- `supabase/migrations/004_academic_rls_policies.sql` - RLS policies

## Next Steps

1. **Add Teacher Notifications:** Notify teachers when assigned to batch
2. **Add Batch Analytics:** Detailed statistics for teachers
3. **Add Student Progress Tracking:** Track student progress per batch
4. **Add Attendance Management:** Teachers can mark attendance
5. **Add Grade Management:** Teachers can assign grades

