# Middleware Implementation - Tenant Resolution & Access Control

## Overview

This document describes the Next.js middleware implementation for multi-tenant LMS SaaS, including subdomain resolution, institute validation, authentication, and role-based access control.

## Architecture

### Request Flow

```
Request → Middleware
    ↓
1. Extract Subdomain
    ↓
2. Validate Institute
    ↓
3. Validate Session
    ↓
4. Check Password Change
    ↓
5. Validate Institute Access
    ↓
6. Check Route Permissions
    ↓
7. Inject Headers
    ↓
Response
```

## Components

### 1. Subdomain Resolution

**File:** `lib/middleware/subdomain.ts`

**Functions:**
- `extractSubdomain(host)` - Extracts subdomain from request host
- `isReservedSubdomain(subdomain)` - Checks if subdomain is reserved

**Examples:**
- `institute1.platform.com` → subdomain: `institute1`
- `platform.com` → subdomain: `null` (main domain)
- `institute1.localhost:3000` → subdomain: `institute1` (dev)

**Reserved Subdomains:**
- www, api, admin, app, dashboard, mail, etc.
- Cannot be used by tenants

### 2. Institute Validation

**File:** `lib/middleware/institute.ts`

**Functions:**
- `getInstituteBySubdomain(subdomain)` - Validates institute with caching
- `clearInstituteCache(subdomain?)` - Clears cache

**Caching:**
- In-memory cache with 5-minute TTL
- Reduces database queries
- Negative results cached for 1 minute

**Validation:**
- Checks if institute exists
- Checks if institute is active (not suspended)
- Returns null if invalid

### 3. Authentication & Authorization

**File:** `lib/middleware/auth.ts`

**Functions:**
- `validateSession(accessToken)` - Validates Supabase session
- `hasRole(session, roleName)` - Checks if user has role
- `isSuperAdmin(session)` - Checks if user is SUPER_ADMIN
- `belongsToInstitute(session, instituteId)` - Validates institute membership

**Session Data:**
```typescript
{
  userId: string;
  email: string;
  instituteId: string | null;
  roles: string[];
  mustChangePassword: boolean;
}
```

**Caching:**
- In-memory cache with 2-minute TTL
- Caches full session including roles
- Reduces database queries

### 4. Route Guards

**File:** `lib/middleware/routes.ts`

**Route Matrix:**

| Route | Required Role | SUPER_ADMIN Override |
|-------|--------------|---------------------|
| `/super-admin/**` | SUPER_ADMIN | No (only SUPER_ADMIN) |
| `/admin/**` | INSTITUTE_ADMIN | Yes |
| `/teacher/**` | TEACHER | Yes |
| `/student/**` | STUDENT | Yes |

**Public Routes:**
- `/login`
- `/auth/**`
- `/api/auth/**`
- `/_next/**` (Next.js internals)

**Functions:**
- `canAccessRoute(pathname, session)` - Checks route access
- `getUnauthorizedRedirect(pathname, reason)` - Gets redirect URL

### 5. Main Middleware

**File:** `middleware.ts`

**Steps:**

1. **Extract Subdomain**
   - Parse request host
   - Determine if main domain or subdomain

2. **Handle Main Domain**
   - Platform-level routes (login, super-admin)
   - No institute context required
   - Still validates authentication and roles

3. **Handle Subdomain**
   - Extract subdomain from host
   - Check if reserved
   - Validate institute exists and is active

4. **Authentication**
   - Extract access token from cookies or headers
   - Validate with Supabase
   - Get user profile and roles

5. **Password Change Enforcement**
   - If `must_change_password = true`
   - Redirect to `/change-password`
   - Block access to other routes

6. **Institute Access Validation**
   - Non-SUPER_ADMIN users must belong to institute
   - SUPER_ADMIN can access any institute

7. **Route Access Control**
   - Check if user has required role
   - Apply SUPER_ADMIN override if allowed
   - Redirect if unauthorized

8. **Inject Headers**
   - `x-institute-id` - Institute UUID
   - `x-institute-subdomain` - Subdomain
   - `x-institute-status` - Status (active/suspended)
   - `x-user-id` - User UUID
   - `x-user-email` - User email
   - `x-user-roles` - Comma-separated roles

## Request Headers Injected

The middleware injects the following headers into requests:

```
x-institute-id: <uuid>
x-institute-subdomain: <subdomain>
x-institute-status: active
x-user-id: <uuid> (if authenticated)
x-user-email: <email> (if authenticated)
x-user-roles: SUPER_ADMIN,INSTITUTE_ADMIN (if authenticated)
```

**Usage in Server Components:**
```typescript
import { getMiddlewareContext } from '@/lib/middleware/helpers';

export default async function Page() {
  const { instituteId, userId, roles } = await getMiddlewareContext();
  // Use context...
}
```

**Usage in API Routes:**
```typescript
import { headers } from 'next/headers';

export async function GET(request: Request) {
  const headersList = await headers();
  const instituteId = headersList.get('x-institute-id');
  // Use instituteId...
}
```

## Redirects

### Authentication Redirects

**Not Authenticated:**
- Redirect to: `/login?redirect=<original-path>`
- Preserves original URL for post-login redirect

**Password Change Required:**
- Redirect to: `/change-password`
- Blocks all other routes until password changed

### Authorization Redirects

**Insufficient Permissions:**
- Redirect to: `/` (user's dashboard)
- Or role-specific dashboard based on user's roles

**Invalid Institute:**
- Redirect to: `/institute-not-found`
- Shown when subdomain doesn't exist or is suspended

**Unauthorized Institute Access:**
- Redirect to: `/unauthorized`
- Shown when user tries to access different institute

## Caching Strategy

### Institute Cache

- **TTL:** 5 minutes
- **Storage:** In-memory Map
- **Key:** Subdomain
- **Value:** Institute ID and status

**Why:** Reduces database queries for subdomain lookups.

**Invalidation:** Manual via `clearInstituteCache()` (call after institute updates).

### Session Cache

- **TTL:** 2 minutes
- **Storage:** In-memory Map
- **Key:** Access token
- **Value:** Full session data (user, roles, institute)

**Why:** Reduces Supabase Auth API calls and database queries.

**Invalidation:** Automatic after TTL, or manual via `clearSessionCache()`.

### Production Considerations

For production with multiple server instances:
- Use Redis or similar for distributed caching
- Implement cache invalidation webhooks
- Consider shorter TTLs for more dynamic data

## Security Considerations

### 1. Server-Side Only

- All validation happens in middleware (server-side)
- No client-side checks for security
- Headers are injected server-side, not trusted from client

### 2. Token Validation

- Supabase access tokens validated on every request
- Invalid tokens result in authentication redirect
- Session cache reduces validation overhead

### 3. Institute Isolation

- Users can only access their own institute
- SUPER_ADMIN exception explicitly checked
- Cross-institute access blocked at middleware level

### 4. Role Enforcement

- Route access checked against database roles
- Not based on JWT claims alone
- Roles fetched from database (cached)

### 5. Password Security

- Password change enforced before any other access
- Blocks all routes except `/change-password`
- Enforced at middleware level

## Error Scenarios

### Invalid Subdomain

**Scenario:** User visits `invalid.platform.com`

**Flow:**
1. Extract subdomain: `invalid`
2. Validate institute: Not found
3. Redirect to: `/institute-not-found`

### Suspended Institute

**Scenario:** User visits `suspended.platform.com` (institute exists but suspended)

**Flow:**
1. Extract subdomain: `suspended`
2. Validate institute: Found but status = `suspended`
3. Redirect to: `/institute-not-found`

### Wrong Institute

**Scenario:** User from Institute A tries to access `institute-b.platform.com`

**Flow:**
1. Extract subdomain: `institute-b`
2. Validate institute: Found
3. Validate session: User belongs to Institute A
4. Check access: User doesn't belong to Institute B
5. Redirect to: `/unauthorized`

### Insufficient Permissions

**Scenario:** Student tries to access `/admin/users`

**Flow:**
1. Extract subdomain: Valid
2. Validate institute: Valid
3. Validate session: Valid
4. Check route: `/admin` requires `INSTITUTE_ADMIN`
5. User has role: `STUDENT`
6. Redirect to: `/` (dashboard)

## Testing

### Manual Testing

1. **Test Subdomain Resolution:**
   ```bash
   # Main domain
   curl -H "Host: platform.com" http://localhost:3000/
   
   # Subdomain
   curl -H "Host: institute1.platform.com" http://localhost:3000/
   ```

2. **Test Authentication:**
   - Visit subdomain without login
   - Should redirect to `/login`

3. **Test Role Access:**
   - Login as different roles
   - Try accessing protected routes
   - Verify redirects

4. **Test Password Change:**
   - Set `must_change_password = true` in database
   - Login
   - Should redirect to `/change-password`

### Integration Testing

Test scenarios:
- [ ] Main domain access (no subdomain)
- [ ] Valid subdomain with active institute
- [ ] Invalid subdomain
- [ ] Suspended institute
- [ ] Unauthenticated access
- [ ] Authenticated access with correct role
- [ ] Authenticated access with wrong role
- [ ] Password change enforcement
- [ ] Cross-institute access prevention
- [ ] SUPER_ADMIN override

## Performance

### Optimization

1. **Caching:**
   - Institute lookups cached (5 min)
   - Session data cached (2 min)
   - Reduces database queries by ~90%

2. **Early Returns:**
   - Public routes checked first
   - Invalid subdomains rejected early
   - No unnecessary database queries

3. **Parallel Operations:**
   - Institute validation and session validation can be parallelized
   - Currently sequential for simplicity

### Metrics to Monitor

- Middleware execution time
- Cache hit rate
- Database query count
- Redirect frequency
- Error rates

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application
NEXT_PUBLIC_APP_URL=https://yourplatform.com
NEXT_PUBLIC_MAIN_DOMAIN=yourplatform.com
```

## Related Files

- `middleware.ts` - Main middleware entry point
- `lib/middleware/subdomain.ts` - Subdomain parsing
- `lib/middleware/institute.ts` - Institute validation
- `lib/middleware/auth.ts` - Authentication & authorization
- `lib/middleware/routes.ts` - Route guards
- `lib/middleware/helpers.ts` - Helper functions for server components

## Next Steps

1. **Add Error Pages:**
   - `/institute-not-found` page
   - `/unauthorized` page
   - `/invalid-subdomain` page

2. **Add Dashboard Redirects:**
   - Role-based dashboard routing
   - Redirect users to appropriate dashboard after login

3. **Add Cache Invalidation:**
   - Webhook for institute updates
   - Webhook for role changes
   - Manual cache clearing endpoints

4. **Add Monitoring:**
   - Log middleware execution
   - Track cache hit rates
   - Monitor redirect patterns

5. **Production Optimization:**
   - Replace in-memory cache with Redis
   - Add distributed cache invalidation
   - Optimize database queries

