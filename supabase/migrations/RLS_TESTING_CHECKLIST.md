# RLS Testing Checklist

Use this checklist to manually verify RLS policies in the Supabase SQL Editor.

## Setup (Run as SUPER_ADMIN using Service Role)

```sql
-- 1. Create test institutes
INSERT INTO institutes (name, subdomain, status) VALUES
    ('Test Institute A', 'institute-a', 'active'),
    ('Test Institute B', 'institute-b', 'active')
RETURNING id, subdomain;

-- 2. Create test users in auth.users (via Supabase Dashboard or API)
-- Note: You'll need to create these via Supabase Auth API
-- For testing, assume these user IDs exist:
-- - super_admin_user_id
-- - institute_a_admin_id
-- - institute_b_admin_id
-- - institute_a_teacher_id
-- - institute_a_student_id

-- 3. Create profiles for test users
INSERT INTO profiles (id, institute_id, email, first_name, last_name, must_change_password, is_active)
VALUES
    -- SUPER_ADMIN (no institute_id)
    ('super_admin_user_id', NULL, 'superadmin@platform.com', 'Super', 'Admin', false, true),
    -- Institute A users
    ('institute_a_admin_id', 'institute-a-id', 'admin-a@institute-a.com', 'Admin', 'A', false, true),
    ('institute_a_teacher_id', 'institute-a-id', 'teacher-a@institute-a.com', 'Teacher', 'A', false, true),
    ('institute_a_student_id', 'institute-a-id', 'student-a@institute-a.com', 'Student', 'A', false, true),
    -- Institute B users
    ('institute_b_admin_id', 'institute-b-id', 'admin-b@institute-b.com', 'Admin', 'B', false, true);

-- 4. Assign roles
INSERT INTO user_roles (user_id, role_id, institute_id)
SELECT 
    'super_admin_user_id',
    id,
    NULL
FROM roles WHERE name = 'SUPER_ADMIN';

INSERT INTO user_roles (user_id, role_id, institute_id)
SELECT 
    'institute_a_admin_id',
    id,
    'institute-a-id'
FROM roles WHERE name = 'INSTITUTE_ADMIN';

INSERT INTO user_roles (user_id, role_id, institute_id)
SELECT 
    'institute_a_teacher_id',
    id,
    'institute-a-id'
FROM roles WHERE name = 'TEACHER';

INSERT INTO user_roles (user_id, role_id, institute_id)
SELECT 
    'institute_a_student_id',
    id,
    'institute-a-id'
FROM roles WHERE name = 'STUDENT';

INSERT INTO user_roles (user_id, role_id, institute_id)
SELECT 
    'institute_b_admin_id',
    id,
    'institute-b-id'
FROM roles WHERE name = 'INSTITUTE_ADMIN';
```

## Test Cases

### ✅ Test 1: SUPER_ADMIN Can See All Institutes

```sql
-- Simulate SUPER_ADMIN session
SET LOCAL request.jwt.claim.sub = 'super_admin_user_id';

-- Should return all institutes
SELECT id, name, subdomain FROM institutes WHERE deleted_at IS NULL;
```

**Expected Result:** All institutes visible

---

### ✅ Test 2: INSTITUTE_ADMIN Can Only See Own Institute

```sql
-- Simulate Institute A Admin session
SET LOCAL request.jwt.claim.sub = 'institute_a_admin_id';

-- Should return only Institute A
SELECT id, name, subdomain FROM institutes WHERE deleted_at IS NULL;
```

**Expected Result:** Only Institute A visible

---

### ✅ Test 3: INSTITUTE_ADMIN Cannot See Other Institute's Profiles

```sql
-- As Institute A Admin
SET LOCAL request.jwt.claim.sub = 'institute_a_admin_id';

-- Should only see profiles from Institute A
SELECT id, email, institute_id FROM profiles WHERE deleted_at IS NULL;
```

**Expected Result:** Only Institute A profiles visible (not Institute B)

---

### ✅ Test 4: TEACHER Can Only See Own Profile

```sql
-- As Institute A Teacher
SET LOCAL request.jwt.claim.sub = 'institute_a_teacher_id';

-- Should only see own profile
SELECT id, email, institute_id FROM profiles WHERE deleted_at IS NULL;
```

**Expected Result:** Only own profile visible (1 row)

---

### ✅ Test 5: INSTITUTE_ADMIN Cannot Create Profile in Other Institute

```sql
-- As Institute A Admin
SET LOCAL request.jwt.claim.sub = 'institute_a_admin_id';

-- Try to create profile in Institute B (should fail)
INSERT INTO profiles (id, institute_id, email, first_name, last_name)
VALUES (
    gen_random_uuid(),
    'institute-b-id', -- Different institute!
    'hacker@example.com',
    'Hacker',
    'User'
);
```

**Expected Result:** INSERT fails with policy violation

---

### ✅ Test 6: INSTITUTE_ADMIN Cannot Assign SUPER_ADMIN Role

```sql
-- As Institute A Admin
SET LOCAL request.jwt.claim.sub = 'institute_a_admin_id';

-- Try to assign SUPER_ADMIN role (should fail)
INSERT INTO user_roles (user_id, role_id, institute_id)
SELECT 
    'institute_a_teacher_id',
    id,
    'institute-a-id'
FROM roles WHERE name = 'SUPER_ADMIN';
```

**Expected Result:** INSERT fails with policy violation

---

### ✅ Test 7: Soft-Deleted Data is Invisible

```sql
-- As SUPER_ADMIN, soft delete a profile
SET LOCAL request.jwt.claim.sub = 'super_admin_user_id';
UPDATE profiles SET deleted_at = now() WHERE id = 'institute_a_student_id';

-- As Institute A Admin, try to see it
SET LOCAL request.jwt.claim.sub = 'institute_a_admin_id';
SELECT id, email FROM profiles WHERE id = 'institute_a_student_id';
```

**Expected Result:** Query returns zero rows

---

### ✅ Test 8: User Can Update Own Profile

```sql
-- As Institute A Teacher
SET LOCAL request.jwt.claim.sub = 'institute_a_teacher_id';

-- Should be able to update own profile
UPDATE profiles 
SET first_name = 'Updated Name'
WHERE id = auth.uid();
```

**Expected Result:** UPDATE succeeds

---

### ✅ Test 9: User Cannot Update Other Profiles

```sql
-- As Institute A Teacher
SET LOCAL request.jwt.claim.sub = 'institute_a_teacher_id';

-- Try to update another user's profile (should fail or affect 0 rows)
UPDATE profiles 
SET first_name = 'Hacked'
WHERE id = 'institute_a_admin_id';
```

**Expected Result:** UPDATE affects 0 rows (policy prevents access)

---

### ✅ Test 10: Audit Logs Are Tenant-Isolated

```sql
-- Create audit log entries for both institutes
INSERT INTO audit_logs (user_id, institute_id, action, resource_type)
VALUES
    ('institute_a_admin_id', 'institute-a-id', 'CREATE', 'profile'),
    ('institute_b_admin_id', 'institute-b-id', 'CREATE', 'profile');

-- As Institute A Admin
SET LOCAL request.jwt.claim.sub = 'institute_a_admin_id';
SELECT * FROM audit_logs;
```

**Expected Result:** Only Institute A audit logs visible

---

### ✅ Test 11: SUPER_ADMIN Can Manage All Profiles

```sql
-- As SUPER_ADMIN
SET LOCAL request.jwt.claim.sub = 'super_admin_user_id';

-- Should see all profiles
SELECT COUNT(*) FROM profiles WHERE deleted_at IS NULL;
-- Should be able to update any profile
UPDATE profiles SET is_active = false WHERE id = 'institute_b_admin_id';
```

**Expected Result:** All profiles visible and updatable

---

### ✅ Test 12: Helper Functions Work Correctly

```sql
-- Test as different users
SET LOCAL request.jwt.claim.sub = 'super_admin_user_id';
SELECT is_super_admin(), get_user_institute_id();

SET LOCAL request.jwt.claim.sub = 'institute_a_admin_id';
SELECT is_super_admin(), get_user_institute_id(), has_role('INSTITUTE_ADMIN');
```

**Expected Result:** Functions return correct values for each user

---

## Verification Summary

After running all tests, verify:

- [ ] SUPER_ADMIN can access all data
- [ ] INSTITUTE_ADMIN can only access their institute's data
- [ ] TEACHER/STUDENT can only access their own profile
- [ ] Cross-tenant access is impossible
- [ ] Role escalation is prevented
- [ ] Soft-deleted data is invisible
- [ ] Users can update their own profiles
- [ ] Audit logs are tenant-isolated

## Notes

- **Testing in Supabase SQL Editor:** The `SET LOCAL request.jwt.claim.sub` approach shown above is conceptual. In practice:
  - Use Supabase Dashboard to switch between user sessions
  - Or use Supabase client libraries with different user JWT tokens
  - Or use the Supabase REST API with different user tokens
- **Setup:** Use Supabase Service Role key for initial setup queries (bypasses RLS)
- **Production:** These policies are automatically enforced by Supabase on every query
- **Always test in a staging environment first** before deploying to production

