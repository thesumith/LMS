# Backend Logic Flow - Step-by-Step

## Institute Onboarding Flow

This document breaks down the exact step-by-step flow implemented in the API route.

### Step 1: Authentication Check

```typescript
// File: app/api/super-admin/institutes/route.ts
// Line: ~48

const userId = await getCurrentUserId();
if (!userId) {
  throw new UnauthorizedError('Authentication required');
}
```

**What happens:**
- Extracts user ID from Supabase session cookie
- Returns 401 if no authenticated user

**Implementation:** `lib/auth/verify-super-admin.ts` → `getCurrentUserId()`

---

### Step 2: Authorization Check

```typescript
// File: app/api/super-admin/institutes/route.ts
// Line: ~52

const isSuperAdmin = await verifySuperAdmin(userId);
if (!isSuperAdmin) {
  throw new ForbiddenError('Only SUPER_ADMIN can create institutes');
}
```

**What happens:**
- Queries `user_roles` table to check for SUPER_ADMIN role
- Returns 403 if user is not SUPER_ADMIN

**Implementation:** `lib/auth/verify-super-admin.ts` → `verifySuperAdmin(userId)`

**SQL Query (conceptual):**
```sql
SELECT 1
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = $userId
  AND r.name = 'SUPER_ADMIN'
  AND ur.deleted_at IS NULL
```

---

### Step 3: Parse Request Body

```typescript
// File: app/api/super-admin/institutes/route.ts
// Line: ~58

const body: CreateInstituteRequest = await request.json();
const { instituteName, subdomain, adminName, adminEmail } = body;
```

**What happens:**
- Parses JSON request body
- Extracts required fields

---

### Step 4: Input Validation

```typescript
// File: app/api/super-admin/institutes/route.ts
// Line: ~61-75

// Validate institute name
if (!instituteName?.trim()) {
  throw new ValidationError('Institute name is required');
}

// Validate subdomain
if (!subdomain?.trim()) {
  throw new ValidationError('Subdomain is required');
}
if (!validateSubdomain(subdomain.trim().toLowerCase())) {
  throw new ValidationError('Invalid subdomain format');
}

// Validate admin name
if (!adminName?.trim()) {
  throw new ValidationError('Admin name is required');
}

// Validate email
if (!adminEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) {
  throw new ValidationError('Valid admin email is required');
}
```

**What happens:**
- Validates all required fields are present
- Validates subdomain format (3-63 chars, alphanumeric + hyphens)
- Validates email format
- Normalizes subdomain to lowercase
- Normalizes email to lowercase

**Implementation:** `lib/utils/password.ts` → `validateSubdomain()`

---

### Step 5: Check Subdomain Uniqueness

```typescript
// File: app/api/super-admin/institutes/route.ts
// Line: ~80-87

const { data: existingInstitute } = await supabaseAdmin
  .from('institutes')
  .select('id')
  .eq('subdomain', normalizedSubdomain)
  .is('deleted_at', null)
  .single();

if (existingInstitute) {
  throw new ConflictError('Subdomain already exists');
}
```

**What happens:**
- Queries `institutes` table for existing subdomain
- Only checks active institutes (deleted_at IS NULL)
- Returns 409 Conflict if subdomain exists

**SQL Query (conceptual):**
```sql
SELECT id
FROM institutes
WHERE subdomain = $normalizedSubdomain
  AND deleted_at IS NULL
```

---

### Step 6: Check Email Uniqueness

```typescript
// File: app/api/super-admin/institutes/route.ts
// Line: ~90-95

const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(
  normalizedEmail
);

if (existingUser?.user) {
  throw new ConflictError('Email already registered');
}
```

**What happens:**
- Checks Supabase Auth for existing user with email
- Returns 409 Conflict if email exists

**API Call:** Supabase Admin API → `getUserByEmail()`

---

### Step 7: Generate Temporary Password

```typescript
// File: app/api/super-admin/institutes/route.ts
// Line: ~98

const temporaryPassword = generateTemporaryPassword();
```

**What happens:**
- Generates 12-character secure password
- Mix of uppercase, lowercase, numbers
- Excludes ambiguous characters (I, O, l, o, 0, 1)

**Implementation:** `lib/utils/password.ts` → `generateTemporaryPassword()`

**Example Output:** `Ab3xY9mK2pQ7`

---

### Step 8: Create Institute (Transaction Start)

```typescript
// File: app/api/super-admin/institutes/route.ts
// Line: ~105-115

const { data: institute, error: instituteError } = await supabaseAdmin
  .from('institutes')
  .insert({
    name: instituteName.trim(),
    subdomain: normalizedSubdomain,
    status: 'active',
  })
  .select('id')
  .single();

if (instituteError || !institute) {
  throw new InternalServerError(`Failed to create institute: ${instituteError?.message}`);
}

createdInstituteId = institute.id;
```

**What happens:**
- Inserts new row into `institutes` table
- Sets status to 'active'
- Returns institute ID for use in subsequent steps
- Throws error if creation fails

**SQL Query (conceptual):**
```sql
INSERT INTO institutes (name, subdomain, status)
VALUES ($name, $subdomain, 'active')
RETURNING id;
```

---

### Step 9: Create Auth User

```typescript
// File: app/api/super-admin/institutes/route.ts
// Line: ~118-135

const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
  email: normalizedEmail,
  password: temporaryPassword,
  email_confirm: true,
  user_metadata: {
    name: adminName.trim(),
    institute_id: createdInstituteId,
  },
});

if (authError || !authUser.user) {
  // Rollback: Delete institute
  await supabaseAdmin
    .from('institutes')
    .delete()
    .eq('id', createdInstituteId);

  throw new InternalServerError(`Failed to create auth user: ${authError?.message}`);
}

createdUserId = authUser.user.id;
```

**What happens:**
- Creates user in Supabase Auth
- Sets temporary password
- Auto-confirms email (admin-created user)
- Stores metadata (name, institute_id)
- **Rollback:** If fails, deletes institute
- Returns user ID for use in subsequent steps

**API Call:** Supabase Admin API → `createUser()`

---

### Step 10: Create Profile

```typescript
// File: app/api/super-admin/institutes/route.ts
// Line: ~138-160

const nameParts = adminName.trim().split(' ');
const firstName = nameParts[0] || '';
const lastName = nameParts.slice(1).join(' ') || '';

const { error: profileError } = await supabaseAdmin
  .from('profiles')
  .insert({
    id: createdUserId,
    institute_id: createdInstituteId,
    email: normalizedEmail,
    first_name: firstName,
    last_name: lastName,
    must_change_password: true,
    is_active: true,
  });

if (profileError) {
  // Rollback: Delete auth user and institute
  await supabaseAdmin.auth.admin.deleteUser(createdUserId);
  await supabaseAdmin
    .from('institutes')
    .delete()
    .eq('id', createdInstituteId);

  throw new InternalServerError(`Failed to create profile: ${profileError.message}`);
}
```

**What happens:**
- Splits admin name into first/last name
- Inserts profile linked to auth user (id = auth.users.id)
- Sets `must_change_password = true`
- Sets `is_active = true`
- **Rollback:** If fails, deletes auth user and institute

**SQL Query (conceptual):**
```sql
INSERT INTO profiles (id, institute_id, email, first_name, last_name, must_change_password, is_active)
VALUES ($userId, $instituteId, $email, $firstName, $lastName, true, true);
```

---

### Step 11: Get INSTITUTE_ADMIN Role ID

```typescript
// File: app/api/super-admin/institutes/route.ts
// Line: ~163-175

const { data: role, error: roleError } = await supabaseAdmin
  .from('roles')
  .select('id')
  .eq('name', 'INSTITUTE_ADMIN')
  .is('deleted_at', null)
  .single();

if (roleError || !role) {
  // Rollback: Delete profile, auth user, and institute
  await supabaseAdmin.from('profiles').delete().eq('id', createdUserId);
  await supabaseAdmin.auth.admin.deleteUser(createdUserId);
  await supabaseAdmin
    .from('institutes')
    .delete()
    .eq('id', createdInstituteId);

  throw new InternalServerError('Failed to find INSTITUTE_ADMIN role');
}
```

**What happens:**
- Queries `roles` table for INSTITUTE_ADMIN role
- Returns role ID
- **Rollback:** If fails, deletes profile, auth user, and institute

**SQL Query (conceptual):**
```sql
SELECT id
FROM roles
WHERE name = 'INSTITUTE_ADMIN'
  AND deleted_at IS NULL;
```

---

### Step 12: Assign INSTITUTE_ADMIN Role

```typescript
// File: app/api/super-admin/institutes/route.ts
// Line: ~178-195

const { error: roleAssignmentError } = await supabaseAdmin
  .from('user_roles')
  .insert({
    user_id: createdUserId,
    role_id: role.id,
    institute_id: createdInstituteId,
  });

if (roleAssignmentError) {
  // Rollback: Delete profile, auth user, and institute
  await supabaseAdmin.from('profiles').delete().eq('id', createdUserId);
  await supabaseAdmin.auth.admin.deleteUser(createdUserId);
  await supabaseAdmin
    .from('institutes')
    .delete()
    .eq('id', createdInstituteId);

  throw new InternalServerError(`Failed to assign role: ${roleAssignmentError.message}`);
}
```

**What happens:**
- Inserts role assignment into `user_roles` table
- Links user to INSTITUTE_ADMIN role
- Scopes role to specific institute
- **Rollback:** If fails, deletes profile, auth user, and institute

**SQL Query (conceptual):**
```sql
INSERT INTO user_roles (user_id, role_id, institute_id)
VALUES ($userId, $roleId, $instituteId);
```

---

### Step 13: Send Onboarding Email (Async)

```typescript
// File: app/api/super-admin/institutes/route.ts
// Line: ~198-210

sendOnboardingEmail({
  email: normalizedEmail,
  instituteName: instituteName.trim(),
  subdomain: normalizedSubdomain,
  temporaryPassword,
  adminName: adminName.trim(),
}).catch((error) => {
  // Log email failure but don't throw
  console.error('Failed to send onboarding email:', error);
});
```

**What happens:**
- Sends email asynchronously (non-blocking)
- Email contains:
  - Login URL (subdomain-based)
  - Temporary password
  - Instructions
- **No rollback:** Email failure doesn't affect transaction
- Errors are logged but not thrown

**Implementation:** `lib/utils/email.ts` → `sendOnboardingEmail()`

**Email Content:**
- To: Admin email
- Subject: "Welcome to {instituteName} - Your LMS Access"
- Body: Login URL, temporary password, instructions

---

### Step 14: Return Success Response

```typescript
// File: app/api/super-admin/institutes/route.ts
// Line: ~213-230

return NextResponse.json(
  {
    success: true,
    data: {
      institute: {
        id: createdInstituteId,
        name: instituteName.trim(),
        subdomain: normalizedSubdomain,
      },
      admin: {
        id: createdUserId,
        email: normalizedEmail,
        name: adminName.trim(),
      },
    },
  },
  { status: 201 }
);
```

**What happens:**
- Returns 201 Created status
- Returns institute and admin data
- **Note:** Temporary password is NOT included in response

**Response Format:**
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
      "email": "admin@acme.edu",
      "name": "John Doe"
    }
  }
}
```

---

## Error Handling Flow

### Try-Catch Structure

```typescript
try {
  // Steps 1-6: Validation
  // Step 7: Generate password
  // Step 8-12: Create resources
  
  try {
    // Step 8: Create institute
    
    try {
      // Step 9: Create auth user
      
      try {
        // Step 10: Create profile
        // Step 11: Get role
        // Step 12: Assign role
      } catch (error) {
        // Rollback: Delete auth user and institute
        throw error;
      }
    } catch (error) {
      // Rollback: Delete institute
      throw error;
    }
  } catch (error) {
    // All rollbacks handled
    throw error;
  }
  
  // Step 13: Send email (async, non-blocking)
  // Step 14: Return success
  
} catch (error) {
  // Format and return error response
  const { statusCode, body } = formatErrorResponse(error);
  return NextResponse.json(body, { status: statusCode });
}
```

### Rollback Order

1. **If role assignment fails:**
   - Delete profile
   - Delete auth user
   - Delete institute

2. **If profile creation fails:**
   - Delete auth user
   - Delete institute

3. **If auth user creation fails:**
   - Delete institute

4. **If institute creation fails:**
   - No cleanup needed

---

## Summary

**Total Steps:** 14
**Database Operations:** 5 (institute, auth user, profile, role lookup, role assignment)
**API Calls:** 2 (getUserByEmail, createUser)
**Rollback Points:** 4 (after each resource creation)
**Email:** 1 (async, non-blocking)

**Transaction Safety:** Manual rollback ensures atomicity across auth and database operations.

