# Certificate System - Implementation Guide

## Overview

This document describes the implementation of course completion certificates in the multi-tenant LMS SaaS, including eligibility evaluation, PDF generation, and secure verification.

## Architecture

### Certificate Issuance Flow

```
Student meets eligibility requirements
    ↓
POST /api/institute/certificates/issue
    ↓
Evaluate eligibility (database function)
    ↓
Generate certificate number
    ↓
Generate PDF certificate
    ↓
Upload PDF to Supabase Storage
    ↓
Create certificate record
    ↓
Return certificate data
```

### Automatic Certificate Generation

```
Student completes course requirements
    ↓
System checks eligibility
    ↓
If eligible, auto-generate certificate
    ↓
Store PDF and create record
```

### Certificate Verification Flow

```
Public user → GET /api/public/certificates/verify/[certificateNumber]
    ↓
Lookup certificate by number
    ↓
Return public-safe information
    ↓
No student data exposed
```

## Data Model

### course_certificate_rules Table

**Fields:**
- `id` (UUID) - Primary key
- `institute_id` (UUID) - Foreign key to institutes
- `course_id` (UUID) - Foreign key to courses
- `min_attendance_percentage` (INTEGER) - Minimum attendance required (0-100)
- `require_exam_pass` (BOOLEAN) - Whether exam must be passed
- `require_assignment_completion` (BOOLEAN) - Whether all assignments must be completed
- `is_active` (BOOLEAN) - Active status
- `created_at`, `updated_at`, `deleted_at` - Timestamps

**Constraints:**
- Unique: `course_id` (one rule per course)

### certificates Table

**Fields:**
- `id` (UUID) - Primary key
- `institute_id` (UUID) - Foreign key to institutes
- `student_id` (UUID) - Foreign key to profiles
- `course_id` (UUID) - Foreign key to courses
- `batch_id` (UUID) - Foreign key to batches
- `certificate_number` (VARCHAR) - Unique certificate identifier
- `issued_at` (TIMESTAMPTZ) - Issue timestamp
- `issued_by` (UUID) - User who issued (NULL for auto-generated)
- `storage_path` (TEXT) - Path to PDF in Supabase Storage
- `is_reissued` (BOOLEAN) - True if reissued
- `reissued_from_id` (UUID) - Link to original if reissued
- `created_at`, `updated_at`, `deleted_at` - Timestamps

**Constraints:**
- Unique: `certificate_number` (global uniqueness)
- Unique: `student_id + course_id + batch_id` (one certificate per student per course per batch)

## Eligibility Evaluation

### Database Function

**Function:** `evaluate_certificate_eligibility(student_id, course_id, batch_id)`

**Returns:**
- `is_eligible` - Overall eligibility status
- `attendance_percentage` - Calculated attendance percentage
- `meets_attendance` - Whether attendance requirement is met
- `exam_passed` - Whether exam is passed (if required)
- `assignments_completed` - Whether assignments are completed (if required)
- `eligibility_details` - JSONB with detailed breakdown

**Evaluation Logic:**
1. Check if certificate rules exist for course
2. Calculate attendance percentage from attendance_records
3. Check exam pass status (if required)
4. Check assignment completion (if required)
5. Return eligibility result

**Example:**
```sql
SELECT * FROM evaluate_certificate_eligibility(
    'student-uuid',
    'course-uuid',
    'batch-uuid'
);
```

## Certificate Number Generation

**Format:** `CERT-{INST}-{COURSE}-{YEAR}-{SEQUENCE}`

**Example:** `CERT-ABC-CS101-2024-000001`

**Generation:**
- Uses database function `generate_certificate_number()`
- Ensures uniqueness per institute/course/batch combination
- Sequential numbering per batch

## Row Level Security (RLS)

### Course Certificate Rules Policies

#### SELECT
- **SUPER_ADMIN:** All active rules
- **INSTITUTE_ADMIN:** All rules in institute
- **TEACHER:** Rules for courses they are assigned to
- **STUDENT:** Rules for courses in enrolled batches

#### INSERT/UPDATE/DELETE
- **SUPER_ADMIN:** All rules
- **INSTITUTE_ADMIN:** Rules in their institute

### Certificates Policies

#### SELECT
- **SUPER_ADMIN:** All active certificates
- **INSTITUTE_ADMIN:** All certificates in institute
- **TEACHER:** Certificates for batches they are assigned to (read-only)
- **STUDENT:** Only their own certificates

#### INSERT
- **SUPER_ADMIN:** Can issue any certificate
- **INSTITUTE_ADMIN:** Can issue certificates in institute
- **System:** Can auto-generate via SECURITY DEFINER function

#### UPDATE/DELETE
- **SUPER_ADMIN:** Can update/delete any certificate
- **INSTITUTE_ADMIN:** Can update/delete certificates in institute

## API Endpoints

### Certificate Rules

#### `POST /api/institute/courses/[courseId]/certificate-rules`

Create or update certificate eligibility rules.

**Request:**
```json
{
  "minAttendancePercentage": 75,
  "requireExamPass": true,
  "requireAssignmentCompletion": false,
  "isActive": true
}
```

**Response (201/200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "course_id": "uuid",
    "min_attendance_percentage": 75,
    "require_exam_pass": true,
    "require_assignment_completion": false,
    "is_active": true
  }
}
```

#### `GET /api/institute/courses/[courseId]/certificate-rules`

Get certificate rules for a course.

### Certificate Issuance

#### `POST /api/institute/certificates/issue`

Issue a certificate (manual or automatic).

**Request:**
```json
{
  "studentId": "uuid",
  "courseId": "uuid",
  "batchId": "uuid",
  "skipEligibilityCheck": false
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Certificate issued successfully",
  "data": {
    "id": "uuid",
    "certificate_number": "CERT-ABC-CS101-2024-000001",
    "issued_at": "2024-12-15T00:00:00Z",
    "courses": {...},
    "batches": {...}
  }
}
```

**If not eligible:**
```json
{
  "success": false,
  "message": "Student does not meet eligibility requirements",
  "data": {
    "eligibility": {
      "isEligible": false,
      "attendancePercentage": 65.5,
      "meetsAttendance": false,
      "eligibilityDetails": {...}
    }
  }
}
```

### Certificate Reissuance

#### `POST /api/institute/certificates/[certificateId]/reissue`

Reissue a certificate.

**Request:**
```json
{
  "generateNewNumber": false
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Certificate reissued successfully",
  "data": {
    "originalCertificate": {...},
    "newCertificate": {...}
  }
}
```

### Student View

#### `GET /api/student/certificates`

Get student's own certificates.

**Query Parameters:**
- `courseId` (UUID) - Filter by course
- `batchId` (UUID) - Filter by batch
- `includeSignedUrl` (boolean) - Include signed URLs

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "certificate_number": "CERT-ABC-CS101-2024-000001",
      "issued_at": "2024-12-15T00:00:00Z",
      "courses": {
        "name": "Introduction to Computer Science",
        "code": "CS101"
      },
      "batches": {
        "name": "Fall 2024",
        "start_date": "2024-09-01",
        "end_date": "2024-12-15"
      },
      "signed_url": "https://..." // if includeSignedUrl=true
    }
  ]
}
```

#### `GET /api/student/certificates/[certificateId]/download`

Get signed URL for certificate download.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "certificateId": "uuid",
    "certificateNumber": "CERT-ABC-CS101-2024-000001",
    "downloadUrl": "https://...",
    "expiresIn": 3600
  }
}
```

### Public Verification

#### `GET /api/public/certificates/verify/[certificateNumber]`

Verify a certificate (public endpoint, no authentication).

**Response (200):**
```json
{
  "success": true,
  "valid": true,
  "data": {
    "certificateNumber": "CERT-ABC-CS101-2024-000001",
    "courseName": "Introduction to Computer Science",
    "courseCode": "CS101",
    "batchName": "Fall 2024",
    "batchDuration": "2024-09-01 to 2024-12-15",
    "instituteName": "ABC Institute",
    "issuedAt": "2024-12-15T00:00:00Z"
  }
}
```

**If not found:**
```json
{
  "error": "Certificate not found or invalid",
  "code": "NOT_FOUND"
}
```

## Supabase Storage

### Path Structure

```
institute/{institute_id}/certificates/{certificate_number}.pdf
```

### Storage Policies

#### Upload
- **INSTITUTE_ADMIN:** Can upload to their institute's certificates path
- **System:** Can upload via SECURITY DEFINER function

#### Read
- **STUDENT:** Can read their own certificates
- **TEACHER:** Can read certificates for their batches
- **INSTITUTE_ADMIN:** Can read all certificates in institute

#### Update/Delete
- **INSTITUTE_ADMIN:** Can update/delete certificates in institute

## Edge Cases

### 1. Duplicate Certificate Prevention

**Scenario:** Attempt to issue certificate when one already exists.

**Handling:**
- Unique constraint: `student_id + course_id + batch_id`
- API checks before issuance
- Returns validation error if duplicate

**Implementation:**
```typescript
const existing = await checkExistingCertificate(studentId, courseId, batchId);
if (existing) {
  throw new ValidationError('Certificate already exists');
}
```

### 2. Eligibility Not Met

**Scenario:** Student doesn't meet eligibility requirements.

**Handling:**
- Eligibility evaluated before issuance
- Returns detailed eligibility breakdown
- Admin can override with `skipEligibilityCheck`

**Implementation:**
```typescript
const eligibility = await evaluateEligibility(studentId, courseId, batchId);
if (!eligibility.isEligible) {
  return { success: false, eligibility };
}
```

### 3. Certificate Reissuance

**Scenario:** Admin needs to reissue certificate.

**Handling:**
- Original certificate marked as `is_reissued = true`
- New certificate created with link to original
- Option to generate new certificate number
- Old PDF can be kept or deleted

### 4. Student Data Privacy

**Scenario:** Public verification should not expose student data.

**Handling:**
- Public endpoint returns only course/batch/institute info
- No student name, email, or ID exposed
- Certificate number is sufficient for verification

### 5. Automatic Certificate Generation

**Scenario:** System should auto-generate when eligibility is met.

**Handling:**
- Can be triggered by:
  - Scheduled job checking eligibility
  - Webhook on attendance/progress update
  - Manual trigger by admin
- Uses SECURITY DEFINER function to bypass RLS
- Full audit trail maintained

## Security Considerations

### 1. **Certificate Number Uniqueness**

**Enforcement:**
- Unique constraint on `certificate_number`
- Database function generates sequential numbers
- Prevents duplicate certificate numbers

### 2. **Student Data Privacy**

**Enforcement:**
- Public verification endpoint excludes student data
- Only certificate number, course, batch, institute info
- No PII exposed

### 3. **Storage Access Control**

**Enforcement:**
- Certificates stored in private bucket
- Path-based access control
- Signed URLs for download
- RLS policies enforce access

### 4. **Eligibility Evaluation**

**Enforcement:**
- Database function evaluates eligibility
- Not based on client-side checks
- Cannot be manipulated by client
- Full audit trail

## Testing Scenarios

### Test 1: Configure Certificate Rules

1. Authenticate as Institute Admin
2. POST `/api/institute/courses/[courseId]/certificate-rules`
3. Verify rules created
4. Update rules
5. Verify rules updated

### Test 2: Issue Certificate

1. Authenticate as Institute Admin
2. POST `/api/institute/certificates/issue`
3. Verify eligibility checked
4. Verify certificate created
5. Verify PDF uploaded to storage

### Test 3: Prevent Duplicate

1. Issue certificate for student
2. Try to issue again
3. Verify duplicate error returned
4. Verify no new certificate created

### Test 4: Student Downloads Certificate

1. Authenticate as Student
2. GET `/api/student/certificates`
3. Verify only own certificates returned
4. GET `/api/student/certificates/[certificateId]/download`
5. Verify signed URL generated
6. Verify URL allows PDF download

### Test 5: Public Verification

1. Get certificate number
2. GET `/api/public/certificates/verify/[certificateNumber]`
3. Verify certificate details returned
4. Verify no student data exposed
5. Try invalid certificate number
6. Verify 404 Not Found

### Test 6: Reissue Certificate

1. Authenticate as Institute Admin
2. POST `/api/institute/certificates/[certificateId]/reissue`
3. Verify new certificate created
4. Verify original marked as reissued
5. Verify link to original maintained

## Related Files

- `supabase/migrations/013_certificates_structure.sql` - Table definitions
- `supabase/migrations/014_certificates_rls.sql` - RLS policies
- `supabase/storage/certificates_policies.sql` - Storage policies
- `app/api/institute/courses/[courseId]/certificate-rules/route.ts` - Rules management
- `app/api/institute/certificates/issue/route.ts` - Certificate issuance
- `app/api/institute/certificates/[certificateId]/reissue/route.ts` - Reissuance
- `app/api/student/certificates/route.ts` - Student view
- `app/api/student/certificates/[certificateId]/download/route.ts` - Download
- `app/api/public/certificates/verify/[certificateNumber]/route.ts` - Public verification
- `lib/certificates/eligibility.ts` - Eligibility evaluation
- `lib/certificates/generation.ts` - PDF generation
- `lib/storage/certificates.ts` - Storage utilities

## Next Steps

1. **Implement PDF Generation:** Use pdfkit, puppeteer, or @react-pdf/renderer
2. **Add Certificate Templates:** Customizable certificate designs
3. **Add Automatic Issuance:** Trigger on eligibility met
4. **Add Certificate Analytics:** Track certificate issuance statistics
5. **Add Email Notifications:** Notify students when certificate is issued

