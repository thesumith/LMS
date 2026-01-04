# Institute Onboarding Flow - Implementation Guide

## Overview

This document describes the end-to-end implementation of the institute onboarding workflow, where a SUPER_ADMIN creates a new institute and its first Institute Admin.

## Architecture

### Flow Diagram

```
SUPER_ADMIN Request
    ↓
1. Verify SUPER_ADMIN authorization
    ↓
2. Validate input (subdomain, email, etc.)
    ↓
3. Check uniqueness (subdomain, email)
    ↓
4. Create Institute (database)
    ↓
5. Create Auth User (Supabase Auth)
    ↓
6. Create Profile (database, linked to auth user)
    ↓
7. Assign INSTITUTE_ADMIN Role (database)
    ↓
8. Send Onboarding Email (async, non-blocking)
    ↓
Success Response
```

## Implementation Details

### 1. Authorization

**Location:** `app/api/super-admin/institutes/route.ts`

**Process:**
- Extract user ID from Supabase session
- Query `user_roles` table to verify SUPER_ADMIN role
- Reject request if not SUPER_ADMIN

**Code:**
```typescript
const userId = await getCurrentUserId();
if (!userId) throw new UnauthorizedError();

const isSuperAdmin = await verifySuperAdmin(userId);
if (!isSuperAdmin) throw new ForbiddenError();
```

### 2. Input Validation

**Validations:**
- Institute name: Required, non-empty
- Subdomain: Required, 3-63 chars, lowercase alphanumeric + hyphens
- Admin name: Required, non-empty
- Admin email: Required, valid email format

**Subdomain Rules:**
- Must be unique across all institutes
- Cannot start/end with hyphen
- Cannot contain consecutive hyphens
- Converted to lowercase

**Code:** `lib/utils/password.ts` - `validateSubdomain()`

### 3. Uniqueness Checks

**Before creating:**
1. Check `institutes.subdomain` for existing active institute
2. Check `auth.users.email` for existing user

**If conflicts found:** Return 409 Conflict error

### 4. Transaction Safety

**Challenge:** Supabase doesn't support explicit transactions across `auth.users` and database tables.

**Solution:** Manual rollback on errors:

```typescript
try {
  // Create institute
  const institute = await createInstitute();
  
  try {
    // Create auth user
    const user = await createAuthUser();
    
    try {
      // Create profile
      await createProfile();
      
      // Assign role
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
  // All rollbacks handled
  throw error;
}
```

### 5. Password Generation

**Location:** `lib/utils/password.ts`

**Algorithm:**
- 12 characters
- Mix of uppercase, lowercase, numbers
- Excludes ambiguous characters (I, O, l, o, 0, 1)
- Shuffled for randomness

**Security:**
- Password is generated server-side
- Never stored in plain text
- Only sent via email
- Not returned in API response

### 6. Email Sending

**Location:** `lib/utils/email.ts`

**Process:**
- Email sent asynchronously (non-blocking)
- Email failure doesn't rollback transaction
- Email contains:
  - Login URL (subdomain-based)
  - Temporary password
  - Instructions to change password

**Email Service Integration:**
- Currently uses placeholder (Supabase Edge Function)
- Replace with actual email service (Resend, SendGrid, etc.)

**Development Mode:**
- Logs email to console instead of sending

### 7. Error Handling

**Error Types:**
- `UnauthorizedError` (401): Not authenticated
- `ForbiddenError` (403): Not SUPER_ADMIN
- `ValidationError` (400): Invalid input
- `ConflictError` (409): Subdomain/email already exists
- `InternalServerError` (500): Database/auth errors

**Error Response Format:**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## API Endpoint

### POST `/api/super-admin/institutes`

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

**Error Response (400/401/403/409/500):**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Security Considerations

### 1. Service Role Key Protection

**Critical:** Never expose `SUPABASE_SERVICE_ROLE_KEY` to client.

**Implementation:**
- Only used in server-side API routes
- Stored in environment variables
- Never included in client bundles

### 2. RLS Bypass

**Why:** Admin operations need to bypass RLS to create users and institutes.

**How:** Use `supabaseAdmin` client (service role key).

**Safety:** Authorization still enforced via `verifySuperAdmin()` check.

### 3. Password Security

- Generated server-side only
- Never logged or stored in plain text
- Only transmitted via secure email
- User must change on first login

### 4. Input Sanitization

- All inputs trimmed and validated
- Subdomain normalized to lowercase
- Email normalized to lowercase
- SQL injection prevented by Supabase client

## Environment Variables

Required environment variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application
NEXT_PUBLIC_APP_URL=https://yourplatform.com
```

## Testing

### Manual Testing Steps

1. **Authenticate as SUPER_ADMIN**
   ```bash
   # Get JWT token from Supabase Dashboard or API
   ```

2. **Create Institute**
   ```bash
   curl -X POST https://your-app.com/api/super-admin/institutes \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <super-admin-jwt>" \
     -d '{
       "instituteName": "Test Institute",
       "subdomain": "test-institute",
       "adminName": "Test Admin",
       "adminEmail": "admin@test.edu"
     }'
   ```

3. **Verify Database**
   - Check `institutes` table for new row
   - Check `auth.users` for new user
   - Check `profiles` for new profile
   - Check `user_roles` for INSTITUTE_ADMIN assignment

4. **Verify Email**
   - Check email inbox (or console in dev mode)
   - Verify login URL and temporary password

5. **Test Login**
   - Visit login URL from email
   - Login with temporary password
   - Verify password change prompt

### Error Scenarios

Test these error cases:

1. **Unauthorized:** Request without authentication
2. **Forbidden:** Request as non-SUPER_ADMIN user
3. **Validation:** Invalid subdomain, missing fields
4. **Conflict:** Duplicate subdomain or email
5. **Rollback:** Simulate database error mid-transaction

## Rollback Strategy

If any step fails, the following cleanup occurs:

1. **After auth user creation fails:**
   - Delete institute

2. **After profile creation fails:**
   - Delete auth user
   - Delete institute

3. **After role assignment fails:**
   - Delete profile
   - Delete auth user
   - Delete institute

**Note:** Email sending failures don't trigger rollback (async, non-blocking).

## Future Enhancements

1. **Email Service Integration:**
   - Replace placeholder with actual email service
   - Add email templates
   - Add email delivery tracking

2. **Audit Logging:**
   - Log institute creation to `audit_logs` table
   - Track who created which institute

3. **Subdomain Validation:**
   - Check against reserved subdomains (www, api, admin, etc.)
   - Validate DNS availability

4. **Batch Operations:**
   - Support creating multiple institutes at once
   - Bulk user import

5. **Webhook Support:**
   - Trigger webhooks on institute creation
   - Notify external systems

## Related Files

- `app/api/super-admin/institutes/route.ts` - Main API route
- `lib/supabase/admin.ts` - Admin client (service role)
- `lib/auth/verify-super-admin.ts` - Authorization check
- `lib/utils/password.ts` - Password generation
- `lib/utils/email.ts` - Email sending
- `lib/errors/api-errors.ts` - Error handling

