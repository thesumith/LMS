# Route Access Matrix

## Overview

This document defines the route access rules for the multi-tenant LMS SaaS platform. All access is enforced at the middleware level (server-side).

## Route Guards

### Super Admin Routes

**Path:** `/super-admin/**`

**Required Role:** `SUPER_ADMIN`

**SUPER_ADMIN Override:** No (only SUPER_ADMIN can access)

**Access Rules:**
- Only users with `SUPER_ADMIN` role can access
- No institute context required (platform-level)
- Can be accessed from main domain or any subdomain

**Examples:**
- `/super-admin/institutes` - Manage all institutes
- `/super-admin/users` - Manage all users across institutes
- `/super-admin/settings` - Platform settings

---

### Admin Routes

**Path:** `/admin/**`

**Required Role:** `INSTITUTE_ADMIN`

**SUPER_ADMIN Override:** Yes (SUPER_ADMIN can also access)

**Access Rules:**
- Users with `INSTITUTE_ADMIN` role can access
- SUPER_ADMIN can also access (override)
- Requires institute context (subdomain)
- Users can only access their own institute's admin routes

**Examples:**
- `/admin/users` - Manage users in institute
- `/admin/courses` - Manage courses in institute
- `/admin/settings` - Institute settings

---

### Teacher Routes

**Path:** `/teacher/**`

**Required Role:** `TEACHER`

**SUPER_ADMIN Override:** Yes (SUPER_ADMIN can also access)

**Access Rules:**
- Users with `TEACHER` role can access
- SUPER_ADMIN can also access (override)
- Requires institute context (subdomain)
- Users can only access their own institute's teacher routes

**Examples:**
- `/teacher/courses` - View assigned courses
- `/teacher/students` - View students in courses
- `/teacher/assignments` - Manage assignments

---

### Student Routes

**Path:** `/student/**`

**Required Role:** `STUDENT`

**SUPER_ADMIN Override:** Yes (SUPER_ADMIN can also access)

**Access Rules:**
- Users with `STUDENT` role can access
- SUPER_ADMIN can also access (override)
- Requires institute context (subdomain)
- Users can only access their own institute's student routes

**Examples:**
- `/student/courses` - View enrolled courses
- `/student/assignments` - View assignments
- `/student/grades` - View grades

---

## Public Routes

These routes don't require authentication:

- `/login` - Login page
- `/auth/**` - Auth callbacks
- `/api/auth/**` - Auth API endpoints
- `/_next/**` - Next.js internals
- `/favicon.ico` - Favicon

## Special Routes

### Password Change

**Path:** `/change-password`

**Access:** All authenticated users (if `must_change_password = true`)

**Enforcement:**
- If `must_change_password = true`, user is redirected here
- All other routes are blocked until password is changed
- Applies to all roles

---

## Access Matrix Table

| Route Pattern | SUPER_ADMIN | INSTITUTE_ADMIN | TEACHER | STUDENT | Unauthenticated |
|--------------|-------------|-----------------|---------|---------|-----------------|
| `/super-admin/**` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/admin/**` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/teacher/**` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `/student/**` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `/change-password` | ✅* | ✅* | ✅* | ✅* | ❌ |
| `/login` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/auth/**` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Other routes | ✅ | ✅ | ✅ | ✅ | ❌** |

\* Only if `must_change_password = true`  
\*\* Redirects to `/login`

## Institute Context Requirements

### Routes Requiring Institute Context

These routes must be accessed via subdomain:

- `/admin/**`
- `/teacher/**`
- `/student/**`
- Most application routes

**Validation:**
- Subdomain must exist in `institutes` table
- Institute must be `active` (not suspended)
- User must belong to the institute (unless SUPER_ADMIN)

### Routes Not Requiring Institute Context

These routes can be accessed from main domain:

- `/super-admin/**` (platform-level)
- `/login` (platform-level)
- `/change-password` (platform-level)

**Note:** Even on main domain, authentication and role checks still apply.

## Cross-Institute Access Prevention

**Rule:** Users can only access their own institute's routes.

**Enforcement:**
1. Middleware extracts subdomain
2. Validates institute exists and is active
3. Checks if user belongs to institute
4. Blocks access if user belongs to different institute

**Exception:** SUPER_ADMIN can access any institute.

**Example:**
- User from `institute-a.platform.com` tries to access `institute-b.platform.com`
- Middleware detects user belongs to Institute A
- Request is blocked, redirects to `/unauthorized`

## Route Guard Implementation

### Code Location

**File:** `lib/middleware/routes.ts`

**Configuration:**
```typescript
export const ROUTE_GUARDS: RouteGuard[] = [
  {
    path: '/super-admin',
    requiredRoles: ['SUPER_ADMIN'],
    allowSuperAdmin: false,
  },
  {
    path: '/admin',
    requiredRoles: ['INSTITUTE_ADMIN'],
    allowSuperAdmin: true,
  },
  {
    path: '/teacher',
    requiredRoles: ['TEACHER'],
    allowSuperAdmin: true,
  },
  {
    path: '/student',
    requiredRoles: ['STUDENT'],
    allowSuperAdmin: true,
  },
];
```

### Access Check Flow

1. **Extract pathname** from request
2. **Check if public route** - allow if public
3. **Check authentication** - redirect to login if not authenticated
4. **Find matching route guard** - check if path matches any guard
5. **Check role** - verify user has required role
6. **Check SUPER_ADMIN override** - allow if override enabled and user is SUPER_ADMIN
7. **Allow or redirect** - grant access or redirect based on result

## Redirect Behavior

### Unauthenticated Access

**Redirect To:** `/login?redirect=<original-path>`

**Preserves:** Original URL for post-login redirect

### Insufficient Permissions

**Redirect To:** `/` (user's dashboard)

**Behavior:** User sees their role-appropriate dashboard

### Wrong Institute

**Redirect To:** `/unauthorized`

**Message:** "You don't have access to this institute"

### Password Change Required

**Redirect To:** `/change-password`

**Blocks:** All other routes until password changed

## Testing Scenarios

### Test 1: SUPER_ADMIN Access

**Scenario:** SUPER_ADMIN tries to access `/super-admin/institutes`

**Expected:** ✅ Allowed

---

### Test 2: INSTITUTE_ADMIN Access

**Scenario:** INSTITUTE_ADMIN tries to access `/admin/users` on their institute's subdomain

**Expected:** ✅ Allowed

---

### Test 3: INSTITUTE_ADMIN on Wrong Subdomain

**Scenario:** INSTITUTE_ADMIN from Institute A tries to access `institute-b.platform.com/admin/users`

**Expected:** ❌ Redirected to `/unauthorized`

---

### Test 4: TEACHER Access

**Scenario:** TEACHER tries to access `/teacher/courses` on their institute's subdomain

**Expected:** ✅ Allowed

---

### Test 5: TEACHER Tries Admin Route

**Scenario:** TEACHER tries to access `/admin/users`

**Expected:** ❌ Redirected to `/` (insufficient permissions)

---

### Test 6: Unauthenticated Access

**Scenario:** Unauthenticated user tries to access `/admin/users`

**Expected:** ❌ Redirected to `/login?redirect=/admin/users`

---

### Test 7: Password Change Required

**Scenario:** User with `must_change_password = true` tries to access any route

**Expected:** ❌ Redirected to `/change-password` (except `/change-password` itself)

---

### Test 8: SUPER_ADMIN Override

**Scenario:** SUPER_ADMIN tries to access `/admin/users` on any subdomain

**Expected:** ✅ Allowed (SUPER_ADMIN override)

---

## Security Notes

1. **Server-Side Enforcement:** All checks happen in middleware (server-side)
2. **No Client-Side Checks:** Frontend checks are for UX only, not security
3. **Database-Driven Roles:** Roles are fetched from database, not JWT claims
4. **Institute Isolation:** Cross-institute access is impossible (except SUPER_ADMIN)
5. **Password Enforcement:** Password change is enforced at middleware level

## Related Files

- `middleware.ts` - Main middleware implementation
- `lib/middleware/routes.ts` - Route guard definitions
- `lib/middleware/auth.ts` - Authentication and role checking
- `lib/middleware/institute.ts` - Institute validation

