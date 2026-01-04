# Core Database Schema - SaaS Safety Explanation

## Overview

This schema provides a production-ready foundation for a multi-tenant LMS SaaS platform. Every design decision prioritizes security, scalability, and data isolation.

## Why This Schema is SaaS-Safe

### 1. **Multi-Tenant Data Isolation Foundation**

**Every tenant-scoped table includes `institute_id`:**
- All future LMS tables (courses, enrollments, assignments, etc.) will include `institute_id`
- This enables Row Level Security (RLS) policies to enforce strict tenant isolation
- Queries can efficiently filter by tenant using indexed `institute_id` columns

**Subdomain-based tenant identification:**
- `institutes.subdomain` is unique and indexed
- Enables fast tenant resolution from HTTP requests
- Partial index (`WHERE deleted_at IS NULL`) ensures only active tenants are queried

### 2. **UUID Primary Keys**

**Why UUIDs over auto-incrementing integers:**
- **Security**: Prevents tenant enumeration attacks (can't guess other tenant IDs)
- **Distributed systems**: No conflicts when generating IDs across multiple services
- **Privacy**: Opaque identifiers don't leak business information (e.g., "user 5" vs "user 3a8f2b1c-...")
- **Mergers/acquisitions**: No ID conflicts when merging databases

### 3. **Soft Delete Pattern**

**All business tables support soft deletes via `deleted_at`:**
- **Data recovery**: Accidental deletions can be reversed
- **Audit compliance**: Historical data remains queryable
- **Referential integrity**: Foreign keys remain valid even after "deletion"
- **Performance**: Partial indexes exclude soft-deleted rows from queries

**Implementation:**
- Partial indexes use `WHERE deleted_at IS NULL` to exclude deleted rows
- Queries must explicitly filter `WHERE deleted_at IS NULL` (enforced via RLS)
- `audit_logs` does NOT have soft delete (permanent audit trail)

### 4. **Referential Integrity**

**Foreign keys with appropriate CASCADE/RESTRICT:**
- `profiles.id` → `auth.users.id` (CASCADE): User deletion removes profile
- `profiles.institute_id` → `institutes.id` (RESTRICT): Prevents deleting institutes with users
- `user_roles` → `profiles` (CASCADE): User deletion removes all role assignments
- `audit_logs` → `profiles` (SET NULL): Preserves audit trail even if user is deleted

### 5. **Role-Based Access Control Foundation**

**Flexible role system:**
- `roles` table: Platform-wide role definitions (not tenant-specific)
- `user_roles` table: Many-to-many relationship supporting:
  - Multiple roles per user (e.g., Teacher + Institute Admin)
  - Role scoping to specific institutes
  - SUPER_ADMIN exception (no institute_id required)

**Why separate `user_roles` table:**
- Supports complex permission scenarios
- Allows role assignment per institute (future: cross-institute teachers)
- Enables role history tracking (soft delete preserves history)

### 6. **Performance Optimizations**

**Strategic indexes for multi-tenant queries:**

1. **Tenant isolation indexes:**
   - `idx_profiles_institute_id`: Fast user lookup by tenant
   - `idx_user_roles_user_institute`: Composite index for role checks per tenant
   - All indexes use partial indexes (`WHERE deleted_at IS NULL`) for efficiency

2. **Lookup indexes:**
   - `idx_institutes_subdomain`: O(1) tenant resolution from subdomain
   - `idx_profiles_email`: Fast user lookup by email
   - `idx_profiles_must_change_password`: Efficient query for users needing password reset

3. **Audit trail indexes:**
   - `idx_audit_logs_institute_created`: Time-series queries per tenant
   - `idx_audit_logs_resource`: Fast lookup of actions on specific resources

### 7. **Audit Trail**

**`audit_logs` table design:**
- **No soft delete**: Permanent record for compliance
- **JSONB details**: Flexible schema for different action types
- **IP address & user agent**: Security forensics
- **Indexed by tenant**: Efficient querying per institute
- **Cross-tenant visibility**: Platform-wide audit (Super Admin access)

### 8. **Authentication Integration**

**`profiles` table links to Supabase Auth:**
- `profiles.id` = `auth.users.id` (1:1 relationship)
- Denormalized `email` for easier queries (Supabase Auth email is in separate schema)
- `must_change_password` flag: Enforces password change on first login
- `is_active` flag: Allows disabling accounts without deletion

### 9. **Automatic Timestamps**

**Triggers maintain `updated_at`:**
- No manual timestamp management required
- Consistent across all tables
- Useful for change tracking and cache invalidation

### 10. **Data Model Constraints**

**Enforced at database level:**
- `institutes.status`: CHECK constraint ensures only valid statuses
- `institutes.subdomain`: UNIQUE constraint prevents tenant conflicts
- `roles.name`: UNIQUE constraint prevents duplicate roles
- Foreign keys: Prevent orphaned records

**Application-level validation (not in CHECK constraints):**
- SUPER_ADMIN can have NULL `institute_id` (enforced via RLS/application logic)
- Other roles require `institute_id` (enforced via RLS/application logic)
- These validations are complex and require table lookups, so handled in application layer

## Security Considerations

### What This Schema Enables (with RLS):

1. **Tenant isolation**: RLS policies will filter all queries by `institute_id`
2. **Role-based access**: RLS can check `user_roles` for permission validation
3. **Audit compliance**: All actions can be logged to `audit_logs`
4. **Soft delete enforcement**: RLS can automatically filter `WHERE deleted_at IS NULL`

### What RLS Will Add (Next Step):

- Policies on all tables enforcing `institute_id` matching
- Policies preventing cross-tenant data access
- Policies enforcing role-based permissions
- Policies for SUPER_ADMIN cross-tenant access (if needed)

## Scalability Considerations

1. **Partial indexes**: Only index active (non-deleted) rows
2. **Composite indexes**: Optimize common query patterns (user + institute)
3. **JSONB in audit_logs**: Flexible schema without migrations
4. **UUIDs**: No sequence bottlenecks in distributed systems
5. **Soft deletes**: Can archive old data to separate tables if needed

## Migration Path

This schema is designed to be extended:
- Add LMS tables (courses, enrollments, etc.) following the same patterns
- All new tables will include `institute_id`, timestamps, and soft delete
- RLS policies will be added in subsequent migrations
- No breaking changes required for future features

## Conclusion

This schema provides:
- ✅ **Security**: UUIDs, soft deletes, referential integrity
- ✅ **Scalability**: Strategic indexes, partial indexes, efficient queries
- ✅ **Multi-tenancy**: Foundation for strict data isolation
- ✅ **Maintainability**: Consistent patterns, clear structure, documentation
- ✅ **Compliance**: Audit trail, soft deletes, data retention

The schema is production-ready and follows PostgreSQL best practices for multi-tenant SaaS applications.

