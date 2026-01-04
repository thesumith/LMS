# Institute Onboarding - Implementation Summary

## ✅ Deliverables Completed

### 1. **Backend Logic Flow**

The complete flow is implemented in `app/api/super-admin/institutes/route.ts`:

1. **Authentication Check**: Verify user is authenticated
2. **Authorization Check**: Verify user is SUPER_ADMIN
3. **Input Validation**: Validate all required fields
4. **Uniqueness Checks**: Verify subdomain and email don't exist
5. **Create Institute**: Insert into `institutes` table
6. **Create Auth User**: Create user in Supabase Auth with temporary password
7. **Create Profile**: Insert into `profiles` table linked to auth user
8. **Assign Role**: Insert into `user_roles` table with INSTITUTE_ADMIN role
9. **Send Email**: Async email sending (non-blocking)
10. **Return Response**: Success response with institute and admin data

### 2. **Supabase Admin SDK Usage**

**File**: `lib/supabase/admin.ts`

- Uses `@supabase/supabase-js` with service role key
- Bypasses RLS for admin operations
- Configured with `autoRefreshToken: false` and `persistSession: false` for server-side use

**Usage in API Route:**
```typescript
import { supabaseAdmin } from '@/lib/supabase/admin';

// Create institute
await supabaseAdmin.from('institutes').insert({...});

// Create auth user
await supabaseAdmin.auth.admin.createUser({...});

// Create profile
await supabaseAdmin.from('profiles').insert({...});
```

### 3. **SQL Required**

No additional SQL is required. All operations use:
- Existing `institutes` table
- Existing `profiles` table
- Existing `user_roles` table
- Supabase Auth API (no direct SQL)

### 4. **Next.js API Route**

**File**: `app/api/super-admin/institutes/route.ts`

**Endpoint**: `POST /api/super-admin/institutes`

**Request Body:**
```json
{
  "instituteName": "Acme University",
  "subdomain": "acme",
  "adminName": "John Doe",
  "adminEmail": "john.doe@acme.edu"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "institute": {
      "id": "uuid",
      "name": "Acme University",
      "subdomain": "acme"
    },
    "admin": {
      "id": "uuid",
      "email": "john.doe@acme.edu",
      "name": "John Doe"
    }
  }
}
```

### 5. **Error Handling & Rollback Strategy**

**Error Types:**
- `UnauthorizedError` (401): Not authenticated
- `ForbiddenError` (403): Not SUPER_ADMIN
- `ValidationError` (400): Invalid input
- `ConflictError` (409): Subdomain/email exists
- `InternalServerError` (500): Database/auth errors

**Rollback Implementation:**

Since Supabase doesn't support explicit transactions across auth and database, manual rollback is implemented:

```typescript
try {
  // Create institute
  const institute = await createInstitute();
  
  try {
    // Create auth user
    const user = await createAuthUser();
    
    try {
      // Create profile and assign role
      await createProfile();
      await assignRole();
    } catch (error) {
      // Rollback: Delete auth user and institute
      await deleteAuthUser();
      await deleteInstitute();
      throw error;
    }
  } catch (error) {
    // Rollback: Delete institute
    await deleteInstitute();
    throw error;
  }
} catch (error) {
  // All errors handled
  throw error;
}
```

**Rollback Order:**
1. If profile/role creation fails → Delete auth user → Delete institute
2. If auth user creation fails → Delete institute
3. If institute creation fails → No cleanup needed

### 6. **Security Considerations**

#### ✅ Service Role Key Protection
- Only used in server-side API routes
- Stored in environment variable `SUPABASE_SERVICE_ROLE_KEY`
- Never exposed to client
- File: `lib/supabase/admin.ts`

#### ✅ Authorization Enforcement
- SUPER_ADMIN check via database query (not JWT assumption)
- File: `lib/auth/verify-super-admin.ts`
- Function: `verifySuperAdmin(userId)`

#### ✅ Password Security
- Generated server-side only
- Never stored in plain text
- Never returned in API response
- Only sent via secure email
- File: `lib/utils/password.ts`
- Function: `generateTemporaryPassword()`

#### ✅ Input Validation
- All inputs trimmed and validated
- Subdomain format validation (3-63 chars, alphanumeric + hyphens)
- Email format validation
- Uniqueness checks before creation

#### ✅ RLS Compliance
- Admin operations use service role (bypasses RLS)
- Authorization still enforced via `verifySuperAdmin()`
- Regular operations use RLS-enabled client

## File Structure

```
LMS/
├── app/
│   └── api/
│       └── super-admin/
│           └── institutes/
│               └── route.ts          # Main API endpoint
├── lib/
│   ├── supabase/
│   │   ├── admin.ts                  # Admin client (service role)
│   │   └── server.ts                 # Server client (RLS-enabled)
│   ├── auth/
│   │   └── verify-super-admin.ts     # Authorization check
│   ├── utils/
│   │   ├── password.ts               # Password generation
│   │   └── email.ts                  # Email sending
│   └── errors/
│       └── api-errors.ts             # Error handling
├── types/
│   └── database.types.ts             # Database types
└── docs/
    ├── INSTITUTE_ONBOARDING.md       # Detailed documentation
    └── IMPLEMENTATION_SUMMARY.md      # This file
```

## Environment Variables Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application
NEXT_PUBLIC_APP_URL=https://yourplatform.com
```

## Installation Steps

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Set Environment Variables:**
   - Copy `.env.example` to `.env.local`
   - Fill in Supabase credentials

3. **Generate Database Types (Optional):**
   ```bash
   npx supabase gen types typescript --project-id <project-id> > types/database.types.ts
   ```

4. **Run Migrations:**
   - Apply `001_core_foundation.sql`
   - Apply `002_rls_policies.sql`

5. **Test the Endpoint:**
   ```bash
   # Authenticate as SUPER_ADMIN first
   curl -X POST http://localhost:3000/api/super-admin/institutes \
     -H "Content-Type: application/json" \
     -H "Cookie: sb-access-token=<jwt-token>" \
     -d '{
       "instituteName": "Test Institute",
       "subdomain": "test",
       "adminName": "Test Admin",
       "adminEmail": "admin@test.edu"
     }'
   ```

## Key Implementation Details

### Transaction Safety

**Challenge**: Supabase doesn't support explicit transactions across `auth.users` and database tables.

**Solution**: Manual rollback with try-catch blocks ensuring cleanup on any error.

### Email Sending

**Current Implementation**: Placeholder using Supabase Edge Function.

**To Integrate Real Email Service:**
1. Update `lib/utils/email.ts`
2. Replace `sendOnboardingEmail()` function
3. Options: Resend, SendGrid, AWS SES, Postmark

**Note**: Email sending is async and non-blocking. Failures don't rollback the transaction.

### Password Generation

**Algorithm**: 12-character password with:
- Uppercase letters (excluding I, O)
- Lowercase letters (excluding l, o)
- Numbers (excluding 0, 1)
- Shuffled for randomness

**Security**: Generated server-side, never logged, only sent via email.

## Testing Checklist

- [ ] Install dependencies
- [ ] Set environment variables
- [ ] Run database migrations
- [ ] Create SUPER_ADMIN user manually
- [ ] Test API endpoint with valid data
- [ ] Verify institute created in database
- [ ] Verify auth user created
- [ ] Verify profile created
- [ ] Verify role assigned
- [ ] Check email received (or console in dev mode)
- [ ] Test error cases (unauthorized, invalid input, duplicate subdomain)
- [ ] Test rollback on failure

## Next Steps

1. **Integrate Email Service**: Replace placeholder in `lib/utils/email.ts`
2. **Add Audit Logging**: Log institute creation to `audit_logs` table
3. **Add Frontend**: Create SUPER_ADMIN dashboard for institute creation
4. **Add Validation**: Check against reserved subdomains (www, api, admin, etc.)
5. **Add Testing**: Unit tests and integration tests

## Notes

- TypeScript path aliases are configured in `tsconfig.json`
- All imports use `@/` prefix for absolute paths
- Error handling is standardized via `lib/errors/api-errors.ts`
- Code follows production-grade patterns with proper error handling and rollback

