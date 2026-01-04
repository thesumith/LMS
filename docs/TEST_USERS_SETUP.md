# Test Users Setup Guide

This guide explains how to create test users for all roles in the multi-tenant LMS.

## Quick Setup (Recommended)

### Option 1: Using TypeScript Script

```bash
# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL="https://urdmaeyxdhmpzepphvlp.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run the script
npx tsx scripts/create-test-users.ts
```

### Option 2: Using Shell Script

```bash
# The script will prompt for service role key if not set
./scripts/create-test-users.sh
```

## Manual Setup via Supabase Dashboard

### Step 1: Create Test Institute

1. Go to Supabase Dashboard → SQL Editor
2. Run:

```sql
INSERT INTO institutes (id, name, subdomain, status)
VALUES (
    gen_random_uuid(),
    'Test Institute',
    'test',
    'active'
)
ON CONFLICT (subdomain) DO NOTHING
RETURNING id, name, subdomain;
```

### Step 2: Create Auth Users

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" for each test user:

#### SUPER_ADMIN
- **Email:** `superadmin@test.com`
- **Password:** `Test@123456`
- **Auto Confirm:** ✅ Yes

#### INSTITUTE_ADMIN
- **Email:** `admin@test.com`
- **Password:** `Test@123456`
- **Auto Confirm:** ✅ Yes

#### TEACHER
- **Email:** `teacher@test.com`
- **Password:** `Test@123456`
- **Auto Confirm:** ✅ Yes

#### STUDENT
- **Email:** `student@test.com`
- **Password:** `Test@123456`
- **Auto Confirm:** ✅ Yes

### Step 3: Create Profiles and Assign Roles

Run this SQL in Supabase SQL Editor (replace `{INSTITUTE_ID}` with actual ID):

```sql
-- Get institute ID
DO $$
DECLARE
    v_institute_id UUID;
    v_super_admin_id UUID;
    v_admin_id UUID;
    v_teacher_id UUID;
    v_student_id UUID;
    v_super_admin_role_id UUID;
    v_admin_role_id UUID;
    v_teacher_role_id UUID;
    v_student_role_id UUID;
BEGIN
    -- Get institute ID
    SELECT id INTO v_institute_id
    FROM institutes
    WHERE subdomain = 'test'
    LIMIT 1;
    
    -- Get role IDs
    SELECT id INTO v_super_admin_role_id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1;
    SELECT id INTO v_admin_role_id FROM roles WHERE name = 'INSTITUTE_ADMIN' LIMIT 1;
    SELECT id INTO v_teacher_role_id FROM roles WHERE name = 'TEACHER' LIMIT 1;
    SELECT id INTO v_student_role_id FROM roles WHERE name = 'STUDENT' LIMIT 1;
    
    -- Get user IDs from auth.users
    SELECT id INTO v_super_admin_id FROM auth.users WHERE email = 'superadmin@test.com' LIMIT 1;
    SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@test.com' LIMIT 1;
    SELECT id INTO v_teacher_id FROM auth.users WHERE email = 'teacher@test.com' LIMIT 1;
    SELECT id INTO v_student_id FROM auth.users WHERE email = 'student@test.com' LIMIT 1;
    
    -- Create profiles
    INSERT INTO profiles (id, email, first_name, last_name, institute_id, must_change_password, is_active)
    VALUES
        (v_super_admin_id, 'superadmin@test.com', 'Super', 'Admin', NULL, false, true),
        (v_admin_id, 'admin@test.com', 'Institute', 'Admin', v_institute_id, false, true),
        (v_teacher_id, 'teacher@test.com', 'Test', 'Teacher', v_institute_id, false, true),
        (v_student_id, 'student@test.com', 'Test', 'Student', v_institute_id, false, true)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        institute_id = EXCLUDED.institute_id;
    
    -- Assign roles
    INSERT INTO user_roles (user_id, role_id)
    VALUES
        (v_super_admin_id, v_super_admin_role_id),
        (v_admin_id, v_admin_role_id),
        (v_teacher_id, v_teacher_role_id),
        (v_student_id, v_student_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    RAISE NOTICE '✅ Test users created successfully!';
END $$;
```

## Test User Credentials

After setup, use these credentials to login:

### SUPER_ADMIN
- **Email:** `superadmin@test.com`
- **Password:** `Test@123456`
- **Subdomain:** `main` (or your main domain)
- **Access:** Full platform access

### INSTITUTE_ADMIN
- **Email:** `admin@test.com`
- **Password:** `Test@123456`
- **Subdomain:** `test`
- **Access:** Full access to Test Institute

### TEACHER
- **Email:** `teacher@test.com`
- **Password:** `Test@123456`
- **Subdomain:** `test`
- **Access:** Assigned batches only

### STUDENT
- **Email:** `student@test.com`
- **Password:** `Test@123456`
- **Subdomain:** `test`
- **Access:** Enrolled batches only

## Testing Different Roles

### Test SUPER_ADMIN
1. Login at: `https://main.yourdomain.com` (or main domain)
2. Access: `/super-admin/**` routes
3. Can create institutes, manage all users

### Test INSTITUTE_ADMIN
1. Login at: `https://test.yourdomain.com`
2. Access: `/admin/**` routes
3. Can manage courses, batches, users in Test Institute

### Test TEACHER
1. Login at: `https://test.yourdomain.com`
2. Access: `/teacher/**` routes
3. Can view assigned batches, mark attendance, evaluate assignments

### Test STUDENT
1. Login at: `https://test.yourdomain.com`
2. Access: `/student/**` routes
3. Can view enrolled batches, submit assignments, view progress

## Troubleshooting

### Issue: "User not found"
- **Solution:** Ensure auth user was created in Supabase Dashboard
- **Check:** Authentication → Users

### Issue: "Profile not found"
- **Solution:** Run the profile creation SQL script
- **Check:** Database → Tables → profiles

### Issue: "Role not assigned"
- **Solution:** Run the role assignment SQL script
- **Check:** Database → Tables → user_roles

### Issue: "Cannot access routes"
- **Solution:** Verify middleware is working
- **Check:** Subdomain routing and institute context

## Next Steps

After creating test users:

1. **Create Test Data:**
   - Create a test course
   - Create a test batch
   - Enroll student in batch
   - Assign teacher to batch

2. **Test Features:**
   - Login as different roles
   - Test dashboard access
   - Test file uploads
   - Test RLS enforcement

3. **Verify Security:**
   - Ensure users can only access their own data
   - Verify cross-institute access is blocked
   - Test role-based route guards

