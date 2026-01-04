# Dashboards and Analytics - Implementation Guide

## Overview

This document describes the implementation of role-specific dashboards with optimized analytics for the multi-tenant LMS SaaS. All dashboards use server components, database-level aggregation, and strict RLS enforcement.

## Architecture

### Dashboard Data Flow

```
User Request → Next.js Server Component
    ↓
Extract institute_id and user_id from headers
    ↓
Call database function (SECURITY DEFINER)
    ↓
Function performs aggregation with RLS checks
    ↓
Return aggregated results
    ↓
Render dashboard UI
```

### Key Principles

1. **Server-Side Aggregation:** All aggregation happens at database level
2. **RLS Enforcement:** Functions respect RLS policies
3. **Optimized Queries:** Single function call per dashboard
4. **No Client Filtering:** All filtering done in database
5. **Minimal Data Transfer:** Only aggregated results sent to client

## Database Functions

### `get_institute_admin_dashboard(institute_id)`

**Returns:**
- Total students count
- Total teachers count
- Active courses count
- Active batches count
- Total certificates count
- Average attendance percentage
- Completion rate
- Recent certificates (last 10)

**RLS Considerations:**
- Function uses SECURITY DEFINER to bypass RLS for aggregation
- Only aggregates data for specified institute_id
- No cross-institute data leakage

**Optimization:**
- Single query with subqueries
- Uses indexes on institute_id, deleted_at
- Limits recent certificates to 10

### `get_teacher_dashboard(teacher_id, institute_id)`

**Returns:**
- Assigned batches count
- Total students across batches
- Pending evaluations count
- Average progress percentage
- Recent submissions (last 10)
- Upcoming sessions (next 7 days)

**RLS Considerations:**
- Only includes batches teacher is assigned to
- Filters via batch_teachers relationship
- Respects institute boundaries

**Optimization:**
- Joins batch_teachers for filtering
- Aggregates progress at database level
- Limits recent data to prevent large results

### `get_student_dashboard(student_id, institute_id)`

**Returns:**
- Enrolled courses count
- Total progress percentage
- Certificates count
- Upcoming exams (next 30 days)
- Recent assignments (next 7 days)
- Attendance summary (last 30 days)

**RLS Considerations:**
- Only includes student's own data
- Filters via student_id in all queries
- Respects institute boundaries

**Optimization:**
- Single function call for all metrics
- Date-based filtering for recent data
- Aggregates attendance at database level

## Server Components

### Institute Admin Dashboard

**File:** `app/admin/dashboard/page.tsx`

**Features:**
- Statistics cards (students, teachers, courses, batches, certificates)
- Average attendance and completion rate
- Recent certificates table

**Data Fetching:**
```typescript
const dashboard = await getInstituteAdminDashboard(instituteId);
```

**RLS Enforcement:**
- Function only returns data for specified institute_id
- No cross-institute access possible

### Teacher Dashboard

**File:** `app/teacher/dashboard/page.tsx`

**Features:**
- Statistics cards (batches, students, pending evaluations, progress)
- Recent submissions table
- Upcoming attendance sessions

**Data Fetching:**
```typescript
const dashboard = await getTeacherDashboard(teacherId, instituteId);
```

**RLS Enforcement:**
- Function filters by batch_teachers relationship
- Only includes batches teacher is assigned to

### Student Dashboard

**File:** `app/student/dashboard/page.tsx`

**Features:**
- Statistics cards (courses, progress, certificates, attendance)
- Upcoming exams list
- Recent assignments table
- Attendance summary

**Data Fetching:**
```typescript
const dashboard = await getStudentDashboard(studentId, instituteId);
```

**RLS Enforcement:**
- Function filters by student_id
- Only includes student's own data

## Caching Strategy

### When to Cache

**Cache Dashboard Data:**
- Dashboard queries are expensive (aggregations)
- Data doesn't change frequently
- User experience benefits from fast loading

**Cache Invalidation:**
- Invalidate on data changes (attendance, progress, certificates)
- Use time-based expiration (5-15 minutes)
- Consider user-specific cache keys

### Implementation Options

**Option 1: Next.js Cache (Recommended)**
```typescript
import { unstable_cache } from 'next/cache';

export const getCachedDashboard = unstable_cache(
  async (instituteId: string) => {
    return await getInstituteAdminDashboard(instituteId);
  },
  ['admin-dashboard'],
  {
    revalidate: 300, // 5 minutes
    tags: [`dashboard-${instituteId}`],
  }
);
```

**Option 2: Redis Cache**
```typescript
import { redis } from '@/lib/redis';

export async function getCachedDashboard(instituteId: string) {
  const cacheKey = `dashboard:admin:${instituteId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const data = await getInstituteAdminDashboard(instituteId);
  await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5 minutes
  
  return data;
}
```

**Option 3: Database Materialized Views**
```sql
CREATE MATERIALIZED VIEW admin_dashboard_cache AS
SELECT * FROM get_institute_admin_dashboard(institute_id);

-- Refresh periodically
REFRESH MATERIALIZED VIEW admin_dashboard_cache;
```

## RLS Considerations

### Function Security

**SECURITY DEFINER:**
- Functions use SECURITY DEFINER to bypass RLS for aggregation
- Still enforce institute_id filtering
- No cross-institute data access

**Parameter Validation:**
- Functions validate institute_id matches user's institute
- Functions validate user_id matches authenticated user
- Prevents parameter manipulation attacks

### Data Isolation

**Institute Admin:**
- Can only see data for their institute
- Function filters by institute_id
- No cross-institute aggregation

**Teacher:**
- Can only see data for assigned batches
- Function filters by batch_teachers relationship
- Respects institute boundaries

**Student:**
- Can only see their own data
- Function filters by student_id
- Respects institute boundaries

## Performance Optimization

### Query Optimization

**Indexes:**
- `institute_id` on all tables
- `deleted_at` on all tables (for soft delete filtering)
- `batch_id`, `student_id`, `course_id` for joins
- Composite indexes for common query patterns

**Aggregation:**
- Use COUNT(*) instead of COUNT(column)
- Use FILTER clause for conditional aggregation
- Limit result sets (recent items)

**Joins:**
- Use INNER JOIN when possible
- Filter early in query execution
- Use EXISTS for existence checks

### Example Optimized Query

```sql
-- Bad: Multiple queries, client-side aggregation
SELECT * FROM students WHERE institute_id = ?;
SELECT * FROM teachers WHERE institute_id = ?;
-- ... aggregate in application code

-- Good: Single query, database aggregation
SELECT 
  (SELECT COUNT(*) FROM students WHERE institute_id = ?) AS total_students,
  (SELECT COUNT(*) FROM teachers WHERE institute_id = ?) AS total_teachers;
```

## Edge Cases

### 1. Empty Data

**Scenario:** No data exists for dashboard metrics.

**Handling:**
- Functions return 0 or empty arrays
- UI displays "No data" messages
- Graceful degradation

### 2. Large Datasets

**Scenario:** Many records to aggregate.

**Handling:**
- Limit recent items (10-20)
- Use date-based filtering
- Paginate if needed
- Consider materialized views

### 3. Stale Data

**Scenario:** Cached data becomes outdated.

**Handling:**
- Short cache TTL (5-15 minutes)
- Cache invalidation on updates
- User-specific cache keys
- Real-time updates for critical metrics

### 4. Cross-Institute Access

**Scenario:** User tries to access another institute's data.

**Handling:**
- Middleware validates institute_id
- Functions validate institute_id parameter
- RLS policies enforce isolation
- Return empty results if invalid

## Testing Scenarios

### Test 1: Institute Admin Dashboard

1. Authenticate as Institute Admin
2. Navigate to `/admin/dashboard`
3. Verify statistics are correct
4. Verify only own institute data shown
5. Try to access another institute's data
6. Verify access denied

### Test 2: Teacher Dashboard

1. Authenticate as Teacher
2. Navigate to `/teacher/dashboard`
3. Verify only assigned batches shown
4. Verify pending evaluations correct
5. Verify recent submissions from assigned batches only

### Test 3: Student Dashboard

1. Authenticate as Student
2. Navigate to `/student/dashboard`
3. Verify only own data shown
4. Verify progress calculated correctly
5. Verify upcoming exams/assignments correct

### Test 4: Performance

1. Load dashboard with large dataset
2. Verify query execution time < 1 second
3. Verify cache reduces subsequent load times
4. Verify no N+1 queries

## Related Files

- `supabase/migrations/015_dashboard_functions.sql` - Database functions
- `lib/data/admin-dashboard.ts` - Admin dashboard data fetching
- `lib/data/teacher-dashboard.ts` - Teacher dashboard data fetching
- `lib/data/student-dashboard.ts` - Student dashboard data fetching
- `app/admin/dashboard/page.tsx` - Admin dashboard UI
- `app/teacher/dashboard/page.tsx` - Teacher dashboard UI
- `app/student/dashboard/page.tsx` - Student dashboard UI

## Next Steps

1. **Add Real-Time Updates:** Use Supabase Realtime for live dashboard updates
2. **Add Export Functionality:** Export dashboard data to CSV/PDF
3. **Add Custom Date Ranges:** Allow users to filter by date range
4. **Add Drill-Down:** Click metrics to see detailed breakdowns
5. **Add Comparison Views:** Compare metrics across time periods

