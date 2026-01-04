# Assignments and Submissions - Implementation Guide

## Overview

This document describes the implementation of assignments and student submissions in the multi-tenant LMS SaaS, including assignment creation, submission, and evaluation.

## Architecture

### Assignment Creation Flow

```
Teacher → POST /api/institute/batches/[batchId]/assignments
    ↓
Validate teacher is assigned to batch (RLS)
    ↓
Create assignment record
    ↓
Return assignment data
```

### Submission Flow

```
Student → POST /api/student/assignments/[assignmentId]/submit
    ↓
Validate student is enrolled in batch (RLS)
    ↓
Check for existing submission (prevent overwrite)
    ↓
Upload file to Supabase Storage
    ↓
Create submission record
    ↓
Mark as late if after deadline
    ↓
Return submission data
```

### Evaluation Flow

```
Teacher → PATCH /api/institute/assignments/[assignmentId]/submissions
    ↓
Validate teacher is assigned to batch (RLS)
    ↓
Update submission with marks and feedback
    ↓
Set evaluated_at and evaluated_by
    ↓
Return updated submission
```

## Data Model

### assignments Table

**Fields:**
- `id` (UUID) - Primary key
- `institute_id` (UUID) - Foreign key to institutes
- `batch_id` (UUID) - Foreign key to batches
- `course_id` (UUID) - Foreign key to courses
- `title` (VARCHAR) - Assignment title
- `description` (TEXT) - Assignment description
- `due_date` (TIMESTAMPTZ) - Due date (shown to students)
- `submission_deadline` (TIMESTAMPTZ) - Final deadline (for late marking)
- `max_marks` (INTEGER) - Maximum marks
- `is_active` (BOOLEAN) - Active status
- `created_by` (UUID) - Teacher who created assignment
- `created_at`, `updated_at`, `deleted_at` - Timestamps

**Constraints:**
- `submission_deadline >= due_date`
- `max_marks > 0`
- Can only be edited if no submissions exist (enforced by function)

### assignment_submissions Table

**Fields:**
- `id` (UUID) - Primary key
- `institute_id` (UUID) - Foreign key to institutes
- `assignment_id` (UUID) - Foreign key to assignments
- `batch_id` (UUID) - Foreign key to batches
- `student_id` (UUID) - Foreign key to profiles
- `storage_path` (TEXT) - Path in Supabase Storage
- `file_name` (VARCHAR) - Original filename
- `file_size` (BIGINT) - File size in bytes
- `submitted_at` (TIMESTAMPTZ) - Submission timestamp
- `is_late` (BOOLEAN) - Automatically set if after deadline
- `marks` (INTEGER) - Marks awarded (nullable)
- `feedback` (TEXT) - Teacher feedback (nullable)
- `evaluated_at` (TIMESTAMPTZ) - Evaluation timestamp (nullable)
- `evaluated_by` (UUID) - Teacher who evaluated (nullable)
- `created_at`, `updated_at`, `deleted_at` - Timestamps

**Constraints:**
- Unique: `assignment_id + student_id` (one submission per student)
- `marks <= assignment.max_marks` (if marks set)
- `is_late` automatically set by trigger

## Row Level Security (RLS)

### Assignments Policies

#### SELECT
- **SUPER_ADMIN:** All active assignments
- **INSTITUTE_ADMIN:** All assignments in institute
- **TEACHER:** Assignments for batches they are assigned to
- **STUDENT:** Assignments for batches they are enrolled in

#### INSERT
- **SUPER_ADMIN:** Can create any assignment
- **INSTITUTE_ADMIN:** Can create assignments in institute
- **TEACHER:** Can create assignments for batches they are assigned to

#### UPDATE
- **SUPER_ADMIN:** Can update any assignment
- **INSTITUTE_ADMIN:** Can update assignments in institute
- **TEACHER:** Can update assignments for their batches (only if no submissions)

#### DELETE
- **SUPER_ADMIN:** Can delete any assignment
- **INSTITUTE_ADMIN:** Can delete assignments in institute
- **TEACHER:** Can delete their own assignments (only if no submissions)

### Assignment Submissions Policies

#### SELECT
- **SUPER_ADMIN:** All active submissions
- **INSTITUTE_ADMIN:** All submissions in institute
- **TEACHER:** Submissions for batches they are assigned to
- **STUDENT:** Only their own submissions

#### INSERT
- **SUPER_ADMIN:** Can create any submission
- **INSTITUTE_ADMIN:** Can create submissions in institute
- **STUDENT:** Can submit for enrolled batches (one per assignment)

#### UPDATE
- **SUPER_ADMIN:** Can update any submission
- **INSTITUTE_ADMIN:** Can update submissions in institute
- **TEACHER:** Can evaluate submissions (marks/feedback only)
- **STUDENT:** Cannot update (immutable once submitted)

#### DELETE
- **SUPER_ADMIN:** Can delete any submission
- **INSTITUTE_ADMIN:** Can delete submissions in institute
- **TEACHER:** Can delete submissions from their batches
- **STUDENT:** Cannot delete

## Supabase Storage

### Path Structure

```
institute/{institute_id}/assignments/{assignment_id}/submissions/{student_id}/{filename}
```

### Storage Policies

#### Upload
- **STUDENT:** Can upload to their own submission path
- Validates assignment belongs to enrolled batch
- Prevents overwriting existing submissions

#### Read
- **STUDENT:** Can read their own submissions
- **TEACHER:** Can read submissions for their batches
- **INSTITUTE_ADMIN:** Can read all submissions in institute

#### Update/Delete
- **TEACHER:** Can update/delete submissions for their batches
- **STUDENT:** Cannot update/delete (immutable)

## API Endpoints

### Assignments

#### `POST /api/institute/batches/[batchId]/assignments`

Create a new assignment.

**Request:**
```json
{
  "title": "Final Project",
  "description": "Complete the final project",
  "dueDate": "2024-12-15T23:59:59Z",
  "submissionDeadline": "2024-12-20T23:59:59Z",
  "maxMarks": 100,
  "isActive": true
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Final Project",
    "due_date": "2024-12-15T23:59:59Z",
    "submission_deadline": "2024-12-20T23:59:59Z",
    "max_marks": 100,
    "batches": {...},
    "courses": {...}
  }
}
```

#### `GET /api/institute/batches/[batchId]/assignments`

List assignments for a batch.

**Query Parameters:**
- `active` (boolean) - Filter by active status

#### `PATCH /api/institute/assignments/[assignmentId]`

Update assignment (only if no submissions).

**Request:**
```json
{
  "title": "Updated Title",
  "maxMarks": 150
}
```

**Error if submissions exist:**
```json
{
  "error": "Cannot edit assignment. One or more students have already submitted.",
  "code": "CONFLICT"
}
```

### Submissions

#### `POST /api/student/assignments/[assignmentId]/submit`

Submit an assignment.

**Request (Form Data):**
```
file: [File]
```

**Response (201):**
```json
{
  "success": true,
  "message": "Assignment submitted successfully",
  "data": {
    "id": "uuid",
    "submitted_at": "2024-12-15T10:00:00Z",
    "is_late": false,
    "assignments": {...}
  }
}
```

**Late Submission:**
```json
{
  "success": true,
  "message": "Assignment submitted successfully (marked as late)",
  "data": {
    "is_late": true,
    ...
  }
}
```

**Error if already submitted:**
```json
{
  "error": "You have already submitted this assignment. Submissions cannot be overwritten.",
  "code": "CONFLICT"
}
```

#### `GET /api/student/assignments/[assignmentId]/submission`

Get student's own submission.

**Query Parameters:**
- `includeSignedUrl` (boolean) - Include signed URL for file download

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "file_name": "project.pdf",
    "submitted_at": "2024-12-15T10:00:00Z",
    "is_late": false,
    "marks": 85,
    "feedback": "Great work!",
    "evaluated_at": "2024-12-16T14:00:00Z",
    "signed_url": "https://...", // if includeSignedUrl=true
    "assignments": {...}
  }
}
```

### Evaluation

#### `GET /api/institute/assignments/[assignmentId]/submissions`

Get all submissions for an assignment.

**Query Parameters:**
- `includeSignedUrls` (boolean) - Include signed URLs
- `evaluated` (boolean) - Filter by evaluated status
- `late` (boolean) - Filter by late submissions

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "student_id": "uuid",
      "submitted_at": "2024-12-15T10:00:00Z",
      "is_late": false,
      "marks": 85,
      "feedback": "Great work!",
      "profiles": {
        "email": "student@example.com",
        "first_name": "Jane",
        "last_name": "Smith"
      },
      "signed_url": "https://..." // if includeSignedUrls=true
    }
  ]
}
```

#### `PATCH /api/institute/assignments/[assignmentId]/submissions`

Evaluate a submission.

**Request:**
```json
{
  "submissionId": "uuid",
  "marks": 85,
  "feedback": "Great work! Well done."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "marks": 85,
    "feedback": "Great work! Well done.",
    "evaluated_at": "2024-12-16T14:00:00Z",
    "evaluated_by": "teacher-uuid",
    "profiles": {...}
  }
}
```

## Edge Cases

### 1. Late Submission

**Scenario:** Student submits after deadline.

**Handling:**
- Trigger automatically sets `is_late = true`
- Submission is still accepted
- Teacher can see late status
- Marks can still be awarded

**Implementation:**
```sql
-- Trigger checks deadline
IF submitted_at > submission_deadline THEN
    is_late = true
END IF
```

### 2. Re-upload Prevention

**Scenario:** Student tries to submit again.

**Handling:**
- Unique constraint prevents duplicate submissions
- API checks for existing submission before upload
- Returns 409 Conflict error
- File upload is prevented

**Implementation:**
```typescript
// Check for existing submission
const existing = await checkExistingSubmission(assignmentId, studentId);
if (existing) {
  throw new ConflictError('Already submitted');
}
```

### 3. Assignment Editing After Submission

**Scenario:** Teacher tries to edit assignment after student submitted.

**Handling:**
- Function `can_edit_assignment()` checks for submissions
- RLS policy enforces this check
- API validates before update
- Returns 409 Conflict error

**Implementation:**
```sql
-- Function checks if submissions exist
SELECT NOT EXISTS (
    SELECT 1 FROM assignment_submissions
    WHERE assignment_id = p_assignment_id
        AND deleted_at IS NULL
)
```

### 4. Marks Exceeding Maximum

**Scenario:** Teacher tries to enter marks > max_marks.

**Handling:**
- Database constraint: `marks <= assignment.max_marks`
- API validates before update
- Returns validation error

### 5. Student Views Other Student's Submission

**Scenario:** Student tries to access another student's submission.

**Handling:**
- RLS policy: `student_id = auth.uid()`
- Query returns empty result
- API returns 404 Not Found

## Security Considerations

### 1. **File Upload Security**

**Enforcement:**
- File type validation (PDF, DOC, DOCX only)
- File size limit (10MB)
- Path-based access control
- Signed URLs for download

### 2. **Submission Immutability**

**Enforcement:**
- Unique constraint prevents duplicates
- Students cannot update submissions
- RLS blocks UPDATE for students
- Storage policies prevent file overwrite

### 3. **Assignment Editing Restriction**

**Enforcement:**
- Database function checks for submissions
- RLS policy enforces check
- API validates before update
- Prevents editing after first submission

### 4. **Teacher Access Control**

**Enforcement:**
- Teachers can only access batches they are assigned to
- RLS filters by `batch_teachers` relationship
- Storage policies enforce path access
- Cross-institute access blocked

## Testing Scenarios

### Test 1: Teacher Creates Assignment

1. Authenticate as Teacher assigned to batch
2. POST `/api/institute/batches/[batchId]/assignments`
3. Verify assignment created
4. Verify teacher can see assignment

### Test 2: Student Submits Assignment

1. Authenticate as Student enrolled in batch
2. POST `/api/student/assignments/[assignmentId]/submit` with file
3. Verify file uploaded to storage
4. Verify submission record created
5. Verify late status if after deadline

### Test 3: Prevent Re-submission

1. Student submits assignment
2. Try to submit again
3. Verify 409 Conflict error
4. Verify no new file uploaded

### Test 4: Teacher Evaluates Submission

1. Authenticate as Teacher assigned to batch
2. GET `/api/institute/assignments/[assignmentId]/submissions`
3. Verify can see all submissions
4. PATCH with marks and feedback
5. Verify submission updated

### Test 5: Prevent Assignment Edit After Submission

1. Teacher creates assignment
2. Student submits
3. Teacher tries to edit assignment
4. Verify 409 Conflict error
5. Verify assignment not updated

### Test 6: Student Views Own Submission

1. Authenticate as Student
2. GET `/api/student/assignments/[assignmentId]/submission`
3. Verify can see own submission
4. Verify signed URL generated
5. Try to access another student's submission
6. Verify 404 Not Found

## Related Files

- `supabase/migrations/009_assignments_structure.sql` - Table definitions
- `supabase/migrations/010_assignments_rls.sql` - RLS policies
- `supabase/storage/assignments_policies.sql` - Storage policies
- `app/api/institute/batches/[batchId]/assignments/route.ts` - Assignment creation
- `app/api/institute/assignments/[assignmentId]/route.ts` - Assignment management
- `app/api/student/assignments/[assignmentId]/submit/route.ts` - Submission
- `app/api/institute/assignments/[assignmentId]/submissions/route.ts` - Evaluation
- `app/api/student/assignments/[assignmentId]/submission/route.ts` - View submission

## Next Steps

1. **Add Assignment Templates:** Pre-defined assignment templates
2. **Add Peer Review:** Students can review each other's work
3. **Add Plagiarism Detection:** Integrate plagiarism checking
4. **Add Assignment Analytics:** Statistics and insights
5. **Add Bulk Evaluation:** Evaluate multiple submissions at once

