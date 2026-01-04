# Row Level Security (RLS) Implementation - Tenant Isolation Guarantee

## Overview

This RLS implementation provides **strict tenant isolation** at the database level. All policies enforce multi-tenant security, making cross-tenant data access **impossible** without SUPER_ADMIN privileges.

## How Tenant Isolation is Guaranteed

### 1. **RLS is Enabled on All Tables**

```sql
ALTER TABLE institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```

**Impact:** Once RLS is enabled, **no rows are visible** unless explicitly allowed by a policy. This is a deny-by-default security model.

### 2. **Helper Functions Enforce Role Checks**

All policies use helper functions that query the database to determine permissions:

- **`is_super_admin()`**: Checks `user_roles` table for SUPER_ADMIN role
- **`get_user_institute_id()`**: Gets user's `institute_id` from `profiles` table
- **`has_role(role_name)`**: Checks if user has a specific role in their institute
- **`can_access_institute(target_id)`**: Validates institute access

**Why this matters:** Role checks are **database-driven**, not JWT-based. Even if a JWT is tampered with, the database enforces the actual permissions.

### 3. **Institute ID Filtering**

Every policy (except SUPER_ADMIN) filters by `institute_id`:

```sql
-- Example from profiles_select policy
institute_id = get_user_institute_id()
```

**Guarantee:** Users can **only** access rows where `institute_id` matches their own. This is enforced at the SQL level, making cross-tenant queries impossible.

### 4. **SUPER_ADMIN Bypass**

SUPER_ADMIN policies explicitly bypass institute restrictions:

```sql
-- Example from institutes_select_own policy
(is_super_admin() AND deleted_at IS NULL)
OR
(id = get_user_institute_id() AND deleted_at IS NULL)
```

**Security:** SUPER_ADMIN access is **explicitly granted** via role check. Regular users cannot bypass institute restrictions.

### 5. **Soft Delete Filtering**

All SELECT policies include `deleted_at IS NULL` checks:

```sql
-- Example
deleted_at IS NULL
```

**Impact:** Soft-deleted rows are **invisible** to all users, maintaining data integrity while preserving history.

## Policy Breakdown by Table

### **institutes** Table

| Operation | SUPER_ADMIN | INSTITUTE_ADMIN | TEACHER/STUDENT |
|-----------|-------------|-----------------|-----------------|
| SELECT    | All institutes | Own institute only | Own institute only |
| INSERT    | ✅ Yes | ❌ No | ❌ No |
| UPDATE    | ✅ Yes | ❌ No | ❌ No |
| DELETE    | ✅ Yes (soft) | ❌ No | ❌ No |

**Isolation:** Users can only SELECT their own institute. SUPER_ADMIN manages all institutes.

### **profiles** Table

| Operation | SUPER_ADMIN | INSTITUTE_ADMIN | TEACHER/STUDENT |
|-----------|-------------|-----------------|-----------------|
| SELECT    | All profiles | All in institute | Own profile only |
| INSERT    | ✅ Any institute | ✅ Own institute | ❌ No |
| UPDATE    | ✅ Any profile | ✅ In institute | ✅ Own profile |
| DELETE    | ✅ Any (soft) | ✅ In institute (soft) | ❌ No |

**Isolation:** 
- INSTITUTE_ADMIN can manage all profiles in their institute
- TEACHER/STUDENT can only see/update their own profile
- SUPER_ADMIN has full access

### **user_roles** Table

| Operation | SUPER_ADMIN | INSTITUTE_ADMIN | TEACHER/STUDENT |
|-----------|-------------|-----------------|-----------------|
| SELECT    | All assignments | In institute | Own assignments |
| INSERT    | ✅ Any | ✅ In institute (no SUPER_ADMIN) | ❌ No |
| UPDATE    | ✅ Any | ✅ In institute (no SUPER_ADMIN) | ❌ No |
| DELETE    | ✅ Any (soft) | ✅ In institute (soft) | ❌ No |

**Isolation:** INSTITUTE_ADMIN cannot assign SUPER_ADMIN role. All role assignments are scoped to institutes.

### **audit_logs** Table

| Operation | SUPER_ADMIN | INSTITUTE_ADMIN | TEACHER/STUDENT |
|-----------|-------------|-----------------|-----------------|
| SELECT    | All logs | Own institute logs | Own logs |
| INSERT    | ✅ Yes | ✅ Yes | ✅ Yes (via app) |
| UPDATE    | ❌ No | ❌ No | ❌ No |
| DELETE    | ❌ No | ❌ No | ❌ No |

**Isolation:** Audit logs are read-only after creation. Users can only see logs for their institute or their own actions.

## Security Guarantees

### ✅ **Cross-Tenant Access is Impossible**

**Proof:** Every policy (except SUPER_ADMIN) includes:
```sql
institute_id = get_user_institute_id()
```

Even if a user attempts to query:
```sql
SELECT * FROM profiles WHERE institute_id = 'other-tenant-id';
```

RLS will **automatically filter** the results to only include rows where `institute_id` matches the user's institute. The query will return **zero rows** for other tenants.

### ✅ **Role Escalation is Prevented**

**Proof:** INSTITUTE_ADMIN cannot assign SUPER_ADMIN role:
```sql
-- From user_roles_insert_admin policy
AND role_id NOT IN (SELECT id FROM roles WHERE name = 'SUPER_ADMIN')
```

Even if an INSTITUTE_ADMIN tries to INSERT a SUPER_ADMIN role assignment, the policy will **reject** it.

### ✅ **Soft-Deleted Data is Invisible**

**Proof:** All SELECT policies include:
```sql
deleted_at IS NULL
```

Soft-deleted rows are **completely invisible** to all users, including SUPER_ADMIN (unless they explicitly query with `deleted_at IS NOT NULL` in a separate query, which would require a policy allowing it).

### ✅ **Database-Level Enforcement**

**Proof:** All policies use `SECURITY DEFINER` functions that query the database:
- `is_super_admin()` queries `user_roles` table
- `get_user_institute_id()` queries `profiles` table
- `has_role()` queries `user_roles` and `roles` tables

**Impact:** Even if application code is compromised, the database **still enforces** tenant isolation. RLS policies cannot be bypassed by application logic.

## Testing Checklist

Use this checklist to manually test RLS in the Supabase SQL Editor:

### Prerequisites
1. Create test institutes (as SUPER_ADMIN)
2. Create test users with different roles
3. Assign users to different institutes

### Test 1: Tenant Isolation (SELECT)
```sql
-- As INSTITUTE_ADMIN of Institute A
SET LOCAL request.jwt.claim.sub = 'user-id-from-institute-a';
SELECT * FROM profiles; -- Should only see profiles from Institute A

-- As INSTITUTE_ADMIN of Institute B
SET LOCAL request.jwt.claim.sub = 'user-id-from-institute-b';
SELECT * FROM profiles; -- Should only see profiles from Institute B
```

**Expected:** Each user sees only their institute's data.

### Test 2: SUPER_ADMIN Access
```sql
-- As SUPER_ADMIN
SET LOCAL request.jwt.claim.sub = 'super-admin-user-id';
SELECT * FROM institutes; -- Should see all institutes
SELECT * FROM profiles; -- Should see all profiles
```

**Expected:** SUPER_ADMIN sees all data across all tenants.

### Test 3: Role Assignment Prevention
```sql
-- As INSTITUTE_ADMIN (not SUPER_ADMIN)
SET LOCAL request.jwt.claim.sub = 'institute-admin-id';
INSERT INTO user_roles (user_id, role_id, institute_id)
VALUES (
    'some-user-id',
    (SELECT id FROM roles WHERE name = 'SUPER_ADMIN'),
    'institute-id'
);
```

**Expected:** INSERT fails due to policy constraint.

### Test 4: Cross-Tenant INSERT Prevention
```sql
-- As INSTITUTE_ADMIN of Institute A
SET LOCAL request.jwt.claim.sub = 'institute-a-admin-id';
INSERT INTO profiles (id, institute_id, email)
VALUES (
    gen_random_uuid(),
    'institute-b-id', -- Different institute!
    'test@example.com'
);
```

**Expected:** INSERT fails - cannot create profile in different institute.

### Test 5: Soft Delete Visibility
```sql
-- Soft delete a profile (as admin)
UPDATE profiles SET deleted_at = now() WHERE id = 'some-profile-id';

-- Try to SELECT it
SELECT * FROM profiles WHERE id = 'some-profile-id';
```

**Expected:** Query returns zero rows (soft-deleted data is invisible).

### Test 6: User Can See Own Profile
```sql
-- As regular user (TEACHER or STUDENT)
SET LOCAL request.jwt.claim.sub = 'regular-user-id';
SELECT * FROM profiles WHERE id = auth.uid(); -- Should see own profile
SELECT * FROM profiles WHERE id != auth.uid(); -- Should see no other profiles
```

**Expected:** User can only see their own profile row.

### Test 7: Audit Log Isolation
```sql
-- As INSTITUTE_ADMIN of Institute A
SET LOCAL request.jwt.claim.sub = 'institute-a-admin-id';
SELECT * FROM audit_logs; -- Should only see logs for Institute A
```

**Expected:** Only audit logs for Institute A are visible.

## Important Notes

1. **Service Role Key:** Application code that needs to bypass RLS (e.g., creating initial SUPER_ADMIN) must use the Supabase Service Role key. This should **never** be exposed to the client.

2. **Policy Performance:** All helper functions are marked `STABLE`, allowing PostgreSQL to optimize query plans. Indexes on `institute_id` ensure fast policy evaluation.

3. **Policy Order:** PostgreSQL evaluates policies with OR logic. If any policy allows access, the row is visible. Our policies are designed to be mutually exclusive by role.

4. **Testing in Production:** Always test RLS policies in a staging environment first. Incorrect policies can lock out all users.

## Conclusion

This RLS implementation provides **database-level tenant isolation** that cannot be bypassed by application code. Every query is automatically filtered by `institute_id`, making cross-tenant data access **impossible** for non-SUPER_ADMIN users.

The security model is:
- ✅ **Deny-by-default** (RLS enabled)
- ✅ **Database-enforced** (not application-enforced)
- ✅ **Role-based** (permissions derived from database)
- ✅ **Tenant-isolated** (institute_id filtering)
- ✅ **Audit-ready** (all actions can be logged)

