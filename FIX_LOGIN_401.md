# Fix 401 Unauthorized Login Error

## Quick Fix Steps

### Step 1: Restart Your Dev Server

**Important:** Environment variables are only loaded when the server starts.

```bash
# Stop current server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 2: Verify Environment Variables

Check `.env.local` has both:
```env
NEXT_PUBLIC_SUPABASE_URL=https://urdmaeyxdhmpzepphvlp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 3: Create Test Users

The 401 error likely means the user doesn't exist yet. Create test users:

```bash
# Use the service role key from .env.local
node scripts/create-test-users-simple.js YOUR_SERVICE_ROLE_KEY
```

Or get it from `.env.local`:
```bash
grep SERVICE_ROLE .env.local
```

### Step 4: Test Login

Try logging in with:
- **Email:** `student@test.com`
- **Password:** `Test@123456`

## Diagnostic Tool

Run the diagnostic script to check what's wrong:

```bash
node scripts/test-login.js student@test.com
```

This will check:
- ✅ Environment variables
- ✅ Supabase connection
- ✅ User existence
- ✅ Profile existence
- ✅ Role assignments

## Common Causes

1. **User doesn't exist** → Create test users
2. **Server not restarted** → Restart after adding .env.local
3. **Wrong password** → Use `Test@123456` for test users
4. **No profile** → Run profile creation script
5. **No roles** → Run test user script (assigns roles automatically)

## Still Getting 401?

1. Check browser console for detailed error
2. Check server terminal logs
3. Run diagnostic: `node scripts/test-login.js your-email@test.com`
4. Verify user exists in Supabase Dashboard → Authentication → Users

