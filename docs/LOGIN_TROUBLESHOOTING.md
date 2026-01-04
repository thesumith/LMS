# Login Troubleshooting Guide

## Common Issues and Solutions

### Issue: 401 Unauthorized Error

**Symptoms:**
- POST to `/api/auth/login` returns 401
- Error message: "Invalid email or password"

**Possible Causes:**

#### 1. Missing Environment Variables

**Check:**
```bash
# Verify .env.local exists and has correct values
cat .env.local
```

**Solution:**
1. Create `.env.local` file in project root
2. Add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://urdmaeyxdhmpzepphvlp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. Get keys from: https://supabase.com/dashboard/project/urdmaeyxdhmpzepphvlp/settings/api
4. **Restart your Next.js dev server** (environment variables are loaded at startup)

#### 2. User Doesn't Exist

**Check:**
- Go to Supabase Dashboard → Authentication → Users
- Verify user exists

**Solution:**
- Create test users using the script:
```bash
node scripts/create-test-users-simple.js YOUR_SERVICE_ROLE_KEY
```

#### 3. User Has No Profile

**Check:**
```sql
SELECT * FROM profiles WHERE email = 'user@example.com';
```

**Solution:**
- Run the profile creation script: `supabase/seed/create_test_profiles.sql`
- Or use the automated script which creates profiles automatically

#### 4. User Has No Roles

**Check:**
```sql
SELECT ur.*, r.name 
FROM user_roles ur
INNER JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = (SELECT id FROM profiles WHERE email = 'user@example.com');
```

**Solution:**
- Ensure roles are assigned in `user_roles` table
- The test user script assigns roles automatically

#### 5. User is Inactive

**Check:**
```sql
SELECT is_active FROM profiles WHERE email = 'user@example.com';
```

**Solution:**
- Update profile to set `is_active = true`

### Issue: "Server configuration error"

**Cause:** Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Solution:**
1. Create `.env.local` with required variables
2. Restart dev server

### Issue: "User profile not found"

**Cause:** Auth user exists but profile doesn't

**Solution:**
- Run profile creation script
- Or create profile manually:
```sql
INSERT INTO profiles (id, email, first_name, last_name, institute_id, must_change_password, is_active)
VALUES (
  'auth-user-id-here',
  'user@example.com',
  'First',
  'Last',
  'institute-id-here',
  false,
  true
);
```

### Issue: "User has no assigned roles"

**Cause:** Profile exists but no roles assigned

**Solution:**
- Assign role:
```sql
INSERT INTO user_roles (user_id, role_id)
VALUES (
  'user-id-here',
  (SELECT id FROM roles WHERE name = 'STUDENT')
);
```

## Debugging Steps

### Step 1: Check Environment Variables

```bash
# In your terminal
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
```

If empty, create `.env.local` and restart server.

### Step 2: Check Server Logs

Look for errors in:
- Terminal where `npm run dev` is running
- Browser console (F12)
- Network tab (check request/response)

### Step 3: Test Supabase Connection

```bash
# Test if Supabase is accessible
curl https://urdmaeyxdhmpzepphvlp.supabase.co/rest/v1/
```

### Step 4: Verify User in Database

Run in Supabase SQL Editor:
```sql
-- Check if user exists
SELECT * FROM auth.users WHERE email = 'user@example.com';

-- Check profile
SELECT * FROM profiles WHERE email = 'user@example.com';

-- Check roles
SELECT 
  p.email,
  r.name as role
FROM profiles p
INNER JOIN user_roles ur ON p.id = ur.user_id
INNER JOIN roles r ON ur.role_id = r.id
WHERE p.email = 'user@example.com';
```

## Quick Fix Checklist

- [ ] `.env.local` file exists with correct values
- [ ] Next.js dev server restarted after adding `.env.local`
- [ ] User exists in Supabase Auth
- [ ] Profile exists in `profiles` table
- [ ] User has at least one role assigned
- [ ] User's `is_active` is `true`
- [ ] Supabase project is accessible
- [ ] Anon key is correct (not service role key)

## Test User Credentials

After running the test user script:

- **SUPER_ADMIN:** `superadmin@test.com` / `Test@123456`
- **INSTITUTE_ADMIN:** `admin@test.com` / `Test@123456`
- **TEACHER:** `teacher@test.com` / `Test@123456`
- **STUDENT:** `student@test.com` / `Test@123456`

## Still Having Issues?

1. Check browser console for detailed error messages
2. Check server terminal for backend errors
3. Verify Supabase project is active
4. Test with a known working user
5. Check network tab for actual HTTP response

