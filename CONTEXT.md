# Multi-Tenant LMS SaaS - Project Context

## Overview

This is a production-grade, multi-tenant Learning Management System (LMS) built as a SaaS platform.

## Architecture Principles

### Multi-Tenancy
- **Subdomain-based tenancy**: Each institute is identified by its subdomain (e.g., `institute1.platform.com`)
- **Data isolation**: Strict data isolation per tenant using Row Level Security (RLS)
- **Tenant resolution**: Every request must resolve the institute from the subdomain

### Authentication Flow
1. Public signup is **disabled**
2. Only Admins can create users
3. Admin provides:
   - Email address
   - Temporary password
4. User must change password on first login
5. Passwords are never stored in plain text or visible after creation

### Authorization Model
- **RLS-first approach**: All authorization logic enforced at the database level
- **Role-based access**: Institute Admin, Teachers, Students
- **Super Admin**: Platform owner with cross-tenant access (if needed)
- **Institute isolation**: Users can only access data from their own institute

## Data Model Standards

### Required Fields (All Business Tables)
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
institute_id UUID NOT NULL REFERENCES institutes(id)
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
deleted_at TIMESTAMPTZ NULL -- Soft delete
```

### Core Tables Structure
- `institutes`: Tenant information
- `profiles`: User profile data linked to `auth.users.id`
- All LMS tables: courses, enrollments, assignments, etc.

## Tech Stack

### Frontend
- **Next.js 14+** (App Router)
- **React** with Server Components
- **TypeScript** (strongly recommended)

### Backend
- **Supabase**
  - Authentication (email/password only)
  - PostgreSQL database
  - Row Level Security (RLS)
  - Storage for file uploads

## Security Requirements

1. **Never expose service role key** to client-side code
2. **All admin actions** must go through secure API routes
3. **RLS policies** must be comprehensive and tested
4. **Server-side validation** for all critical operations
5. **Explicit error handling** - no silent failures

## Development Guidelines

1. **Think production-first**: Code must be deployment-ready
2. **Explicit over implicit**: Make decisions clear and documented
3. **Security by default**: Assume multi-tenant context in all code
4. **Scalability**: Consider performance implications from the start
5. **Maintainability**: Write clean, readable, well-structured code

## Key Implementation Areas

### 1. Subdomain Resolution
- Middleware to extract subdomain
- Institute lookup and validation
- Session validation per request

### 2. User Management
- Admin user creation flow
- Password reset/change flow
- Role assignment and management

### 3. RLS Policies
- Institute-level isolation
- Role-based access control
- Soft delete handling

### 4. File Storage
- Supabase Storage buckets per institute (or with institute_id prefix)
- Access control via RLS-equivalent policies

## Common Patterns

### Server Action Pattern
```typescript
// Always validate institute context
const instituteId = await getInstituteFromSubdomain(subdomain);
if (!instituteId) throw new Error('Invalid institute');

// Always check user permissions
const user = await getCurrentUser();
if (!user || user.institute_id !== instituteId) {
  throw new Error('Unauthorized');
}
```

### RLS Policy Pattern
```sql
-- Example: Users can only see their own institute's data
CREATE POLICY "Users can only access their institute's data"
ON table_name
FOR ALL
USING (
  institute_id = (
    SELECT institute_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
);
```

## Notes

- This is a real SaaS product, not a tutorial project
- All decisions should consider multi-tenancy implications
- Security and data isolation are non-negotiable
- Code quality must be production-grade

