# Quick Test Users Setup

## 🚀 Fastest Way to Create Test Users

### Step 1: Get Your Service Role Key

1. Go to: https://supabase.com/dashboard/project/urdmaeyxdhmpzepphvlp/settings/api
2. Copy the **service_role** key (not the anon key)
3. Keep it secure - it has admin access!

### Step 2: Run the Script

```bash
# Option 1: Pass key as argument
node scripts/create-test-users-simple.js YOUR_SERVICE_ROLE_KEY

# Option 2: Use environment variable
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
node scripts/create-test-users-simple.js
```

### Step 3: Done!

The script will create:
- ✅ Test Institute (subdomain: `test`)
- ✅ 4 test users with profiles and roles

## 📋 Test User Credentials

After running the script, use these to login:

| Role | Email | Password | Subdomain |
|------|-------|----------|-----------|
| **SUPER_ADMIN** | `superadmin@test.com` | `Test@123456` | `main` |
| **INSTITUTE_ADMIN** | `admin@test.com` | `Test@123456` | `test` |
| **TEACHER** | `teacher@test.com` | `Test@123456` | `test` |
| **STUDENT** | `student@test.com` | `Test@123456` | `test` |

## 🔍 Verify Users

Check in Supabase Dashboard:
- **Authentication → Users** - Should see 4 users
- **Database → Tables → profiles** - Should see 4 profiles
- **Database → Tables → user_roles** - Should see 4 role assignments

## 🆘 Troubleshooting

**Error: "Missing Supabase Service Role Key"**
- Make sure you're using the **service_role** key, not the anon key
- Check the key is correct (starts with `eyJ...`)

**Error: "User already exists"**
- The script will update existing users automatically
- No action needed - users will be updated with correct roles

**Error: "Role not found"**
- Run the seed script first: `supabase/seed/create_test_users.sql`
- This ensures default roles exist

