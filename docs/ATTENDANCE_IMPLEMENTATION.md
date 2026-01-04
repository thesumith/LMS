# Attendance Tracking - Implementation Guide

## Overview

This document describes the implementation of attendance tracking in the multi-tenant LMS SaaS, supporting both manual (teacher-led) and automatic (lesson completion) attendance.

## Architecture

### Manual Attendance Flow

```
Teacher → POST /api/institute/batches/[batchId]/attendance/sessions
    ↓
Create attendance session
    ↓
POST /api/institute/attendance/sessions/[sessionId]/records
    ↓
Mark attendance for students
    ↓
Lock session (optional)
    ↓
Session becomes read-only
```

### Automatic Attendance Flow

```
Student completes lesson
    ↓
lesson_progress.completed_at is set
    ↓
Trigger fires: auto_attendance_on_lesson_complete
    ↓
Function: create_automatic_attendance()
    ↓
Creates attendance session (if not exists)
    ↓
Creates attendance record with audit trail
```

## Data Model

### attendance_sessions Table

**Fields:**
- `id` (UUID) - Primary key
- `institute_id` (UUID) - Foreign key to institutes
- `batch_id` (UUID) - Foreign key to batches
- `session_date` (DATE) - Date of attendance session
- `session_type` (VARCHAR) - 'manual' or 'automatic'
- `lesson_id` (UUID) - For automatic sessions (nullable)
- `title` (VARCHAR) - Optional title for manual sessions
- `description` (TEXT) - Optional description
- `is_locked` (BOOLEAN) - Locked sessions cannot be edited
- `locked_at` (TIMESTAMPTZ) - When session was locked
- `locked_by` (UUID) - Who locked the session
- `created_by` (UUID) - Teacher who created session
- `created_at`, `updated_at`, `deleted_at` - Timestamps

**Constraints:**
- Unique: `batch_id + session_date + session_type + lesson_id` (prevents duplicates)

### attendance_records Table

**Fields:**
- `id` (UUID) - Primary key
- `institute_id` (UUID) - Foreign key to institutes
- `session_id` (UUID) - Foreign key to attendance_sessions
- `batch_id` (UUID) - Foreign key to batches
- `student_id` (UUID) - Foreign key to profiles
- `status` (VARCHAR) - 'present', 'absent', 'late', 'excused'
- `marked_by` (UUID) - Teacher who marked (nullable for automatic)
- `marked_at` (TIMESTAMPTZ) - When attendance was marked
- `notes` (TEXT) - Optional notes
- `is_automatic` (BOOLEAN) - True if marked automatically
- `source_lesson_progress_id` (UUID) - Link to lesson_progress for audit trail
- `created_at`, `updated_at`, `deleted_at` - Timestamps

**Constraints:**
- Unique: `session_id + student_id` (one record per student per session)
- Audit trail: `source_lesson_progress_id` links to lesson completion

## Row Level Security (RLS)

### Attendance Sessions Policies

#### SELECT
- **SUPER_ADMIN:** All active sessions
- **INSTITUTE_ADMIN:** All sessions in institute
- **TEACHER:** Sessions for batches they are assigned to
- **STUDENT:** Sessions for batches they are enrolled in

#### INSERT
- **SUPER_ADMIN:** Can create any session
- **INSTITUTE_ADMIN:** Can create sessions in institute
- **TEACHER:** Can create manual sessions for assigned batches

#### UPDATE
- **SUPER_ADMIN:** Can update any session
- **INSTITUTE_ADMIN:** Can update sessions in institute
- **TEACHER:** Can update sessions for their batches (only if not locked)

#### DELETE
- **SUPER_ADMIN:** Can delete any session
- **INSTITUTE_ADMIN:** Can delete sessions in institute
- **TEACHER:** Can delete their own sessions (only if not locked)

### Attendance Records Policies

#### SELECT
- **SUPER_ADMIN:** All active records
- **INSTITUTE_ADMIN:** All records in institute
- **TEACHER:** Records for batches they are assigned to
- **STUDENT:** Only their own records

#### INSERT
- **SUPER_ADMIN:** Can create any record
- **INSTITUTE_ADMIN:** Can create records in institute
- **TEACHER:** Can create manual records for assigned batches (only if session not locked)
- **System:** Can create automatic records via trigger (SECURITY DEFINER)

#### UPDATE
- **SUPER_ADMIN:** Can update any record
- **INSTITUTE_ADMIN:** Can update records in institute
- **TEACHER:** Can update records for their batches (only if session not locked)
- **STUDENT:** Cannot update (read-only)

#### DELETE
- **SUPER_ADMIN:** Can delete any record
- **INSTITUTE_ADMIN:** Can delete records in institute
- **TEACHER:** Can delete records from their batches (only if session not locked)
- **STUDENT:** Cannot delete

## Automatic Attendance

### Trigger Mechanism

**Trigger:** `auto_attendance_on_lesson_complete`

**Fires:** When `lesson_progress.completed_at` is set (lesson marked as complete)

**Action:**
1. Gets lesson and batch information
2. Calls `create_automatic_attendance()` function
3. Creates session if it doesn't exist
4. Creates attendance record with audit trail

### Audit Trail

**Fields:**
- `is_automatic = true`
- `source_lesson_progress_id` - Links to lesson_progress record
- `marked_by = NULL` (system-generated)
- `status = 'present'` (automatic)

**Benefits:**
- Tracks which lesson completion triggered attendance
- Can verify automatic attendance accuracy
- Prevents duplicate automatic records

## API Endpoints

### Attendance Sessions

#### `POST /api/institute/batches/[batchId]/attendance/sessions`

Create a new attendance session.

**Request:**
```json
{
  "sessionDate": "2024-12-15",
  "title": "Week 10 Attendance",
  "description": "Regular class attendance"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "batch_id": "uuid",
    "session_date": "2024-12-15",
    "session_type": "manual",
    "is_locked": false,
    "batches": {...},
    "courses": {...}
  }
}
```

#### `GET /api/institute/batches/[batchId]/attendance/sessions`

List attendance sessions for a batch.

**Query Parameters:**
- `startDate` (date) - Filter by start date
- `endDate` (date) - Filter by end date
- `type` (string) - Filter by type: 'manual' or 'automatic'

### Attendance Records

#### `POST /api/institute/attendance/sessions/[sessionId]/records`

Mark attendance (single or bulk).

**Single Record:**
```json
{
  "studentId": "uuid",
  "status": "present",
  "notes": "On time"
}
```

**Bulk Records:**
```json
{
  "records": [
    {
      "studentId": "uuid1",
      "status": "present"
    },
    {
      "studentId": "uuid2",
      "status": "absent",
      "notes": "Sick"
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Marked attendance for 2 student(s)",
  "data": [...]
}
```

#### `GET /api/institute/attendance/sessions/[sessionId]/records`

Get all attendance records for a session.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "student_id": "uuid",
      "status": "present",
      "marked_at": "2024-12-15T10:00:00Z",
      "is_automatic": false,
      "profiles": {
        "email": "student@example.com",
        "first_name": "Jane",
        "last_name": "Smith"
      }
    }
  ]
}
```

### Lock Session

#### `POST /api/institute/attendance/sessions/[sessionId]/lock`

Lock an attendance session.

**Response (200):**
```json
{
  "success": true,
  "message": "Session locked successfully",
  "data": {
    "id": "uuid",
    "is_locked": true,
    "locked_at": "2024-12-15T12:00:00Z",
    "locked_by": "teacher-uuid"
  }
}
```

### Student View

#### `GET /api/student/attendance`

Get student's own attendance records.

**Query Parameters:**
- `batchId` (UUID) - Filter by batch
- `startDate` (date) - Filter by start date
- `endDate` (date) - Filter by end date

**Response (200):**
```json
{
  "success": true,
  "data": {
    "records": [...],
    "statistics": {
      "total": 20,
      "present": 18,
      "absent": 1,
      "late": 1,
      "excused": 0,
      "attendancePercentage": 90.0
    }
  }
}
```

## Edge Cases

### 1. Student Added Mid-Course

**Scenario:** Student enrolls in batch after attendance sessions have started.

**Handling:**
- Student is included in new attendance sessions
- Past sessions remain unchanged
- Teacher can manually add student to past sessions (if not locked)
- Automatic attendance works for new lessons

**Implementation:**
```typescript
// When marking attendance, validate student is enrolled
const enrollment = await checkEnrollment(batchId, studentId);
if (!enrollment) {
  throw new NotFoundError('Student is not enrolled in this batch');
}
```

### 2. Session Locking

**Scenario:** Teacher locks session to prevent further edits.

**Handling:**
- Locked sessions cannot be updated
- Locked sessions cannot have new records added
- Locked sessions cannot be deleted
- Locked status is permanent (cannot be unlocked)

**Implementation:**
```sql
-- RLS policy checks is_locked
AND is_locked = false
```

### 3. Automatic Attendance Duplicate Prevention

**Scenario:** Lesson completion triggers attendance multiple times.

**Handling:**
- Unique constraint prevents duplicate records
- Function checks if session exists before creating
- UPSERT handles updates if record exists
- Audit trail preserved

**Implementation:**
```sql
-- Unique constraint
UNIQUE (session_id, student_id, deleted_at)

-- Function checks existing session
SELECT id FROM attendance_sessions
WHERE batch_id = p_batch_id
  AND session_date = v_session_date
  AND session_type = 'automatic'
  AND lesson_id = p_lesson_id;
```

### 4. Lesson Completed Multiple Times

**Scenario:** Student completes lesson, then re-completes it.

**Handling:**
- Trigger only fires when `completed_at` changes from NULL to NOT NULL
- Subsequent completions don't trigger attendance
- Existing attendance record remains

**Implementation:**
```sql
-- Trigger condition
WHEN (NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL)
```

### 5. Manual and Automatic Session Conflict

**Scenario:** Teacher creates manual session for same date as automatic session.

**Handling:**
- Unique constraint includes `session_type`
- Manual and automatic sessions can coexist for same date
- Different session types are separate

**Implementation:**
```sql
-- Unique constraint allows different types
UNIQUE (batch_id, session_date, session_type, lesson_id, deleted_at)
```

## Security Considerations

### 1. **Session Locking**

**Enforcement:**
- Database function locks session atomically
- RLS policies check `is_locked` before UPDATE/INSERT
- API validates before operations
- Prevents edits after session ends

### 2. **Automatic Attendance Audit Trail**

**Enforcement:**
- `is_automatic` flag identifies automatic records
- `source_lesson_progress_id` links to lesson completion
- Cannot be changed to manual (RLS policy)
- Full traceability

### 3. **Student Access Control**

**Enforcement:**
- RLS ensures `student_id = auth.uid()` in all queries
- Students can only see their own records
- Cross-student access is impossible

### 4. **Teacher Access Control**

**Enforcement:**
- Teachers can only access batches they are assigned to
- RLS filters by `batch_teachers` relationship
- Cross-institute access blocked

## Testing Scenarios

### Test 1: Teacher Creates Session

1. Authenticate as Teacher assigned to batch
2. POST `/api/institute/batches/[batchId]/attendance/sessions`
3. Verify session created
4. Verify teacher can see session

### Test 2: Teacher Marks Attendance

1. Authenticate as Teacher
2. POST `/api/institute/attendance/sessions/[sessionId]/records` (bulk)
3. Verify attendance records created
4. Try to update locked session
5. Verify update is blocked

### Test 3: Automatic Attendance

1. Student completes lesson
2. Verify trigger fires
3. Verify attendance session created (if not exists)
4. Verify attendance record created with audit trail
5. Verify `is_automatic = true`
6. Verify `source_lesson_progress_id` is set

### Test 4: Session Locking

1. Teacher creates session
2. Teacher marks attendance
3. POST `/api/institute/attendance/sessions/[sessionId]/lock`
4. Try to update session
5. Verify update is blocked
6. Try to add new records
7. Verify insert is blocked

### Test 5: Student Views Own Attendance

1. Authenticate as Student
2. GET `/api/student/attendance`
3. Verify only own records are returned
4. Verify statistics are calculated correctly
5. Try to access another student's attendance
6. Verify access is blocked

### Test 6: Student Added Mid-Course

1. Create attendance sessions for batch
2. Enroll new student in batch
3. Verify student can be added to new sessions
4. Verify past sessions remain unchanged
5. Teacher can manually add to past sessions (if not locked)

## Related Files

- `supabase/migrations/011_attendance_structure.sql` - Table definitions with triggers
- `supabase/migrations/012_attendance_rls.sql` - RLS policies
- `app/api/institute/batches/[batchId]/attendance/sessions/route.ts` - Session management
- `app/api/institute/attendance/sessions/[sessionId]/records/route.ts` - Record management
- `app/api/institute/attendance/sessions/[sessionId]/lock/route.ts` - Session locking
- `app/api/student/attendance/route.ts` - Student view

## Next Steps

1. **Add Attendance Reports:** Generate attendance reports for teachers
2. **Add Attendance Alerts:** Notify students/parents of low attendance
3. **Add Attendance Analytics:** Track attendance trends over time
4. **Add Bulk Operations:** Bulk mark attendance for multiple sessions
5. **Add Attendance Exports:** Export attendance data to CSV/Excel

