# Pushing SQL Migrations to Supabase

This guide explains how to push all SQL migration files to your Supabase database.

## Migration Files

You have **16 migration files** in the correct order:

1. `001_core_foundation.sql` - Core tables (institutes, profiles, roles, etc.)
2. `002_rls_policies.sql` - RLS policies for core tables
3. `003_academic_structure.sql` - Courses, batches, enrollments
4. `004_academic_rls_policies.sql` - RLS for academic tables
5. `005_content_structure.sql` - Modules and lessons
6. `006_content_rls_policies.sql` - RLS for content tables
7. `007_lesson_progress.sql` - Lesson progress tracking
8. `008_lesson_progress_rls.sql` - RLS for lesson progress
9. `009_assignments_structure.sql` - Assignments and submissions
10. `010_assignments_rls.sql` - RLS for assignments
11. `011_attendance_structure.sql` - Attendance tracking
12. `012_attendance_rls.sql` - RLS for attendance
13. `013_certificates_structure.sql` - Certificate system
14. `014_certificates_rls.sql` - RLS for certificates
15. `015_dashboard_functions.sql` - Dashboard analytics functions
16. `009_storage_bucket.sql` - Storage bucket setup (can be run separately)

## Option 1: Push to Linked Remote Project

If you have a Supabase project already linked:

```bash
# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
supabase db push
```

## Option 2: Push to Local Database

For local development (requires Docker):

```bash
# Start local Supabase
supabase start

# Push migrations to local database
supabase db push --local
```

## Option 3: Push to Specific Database URL

If you have a direct database connection string:

```bash
supabase db push --db-url "postgresql://user:password@host:port/dbname"
```

## Option 4: Use the Helper Script

A helper script is provided:

```bash
# Push to linked project
./push-migrations.sh

# Push to local database
./push-migrations.sh --local

# Push to specific database
./push-migrations.sh --db-url "postgresql://..."
```

## Important Notes

1. **Migration Order**: Migrations are applied in alphabetical order. The numbering (001, 002, etc.) ensures correct sequence.

2. **Dependencies**: Some migrations depend on previous ones:
   - RLS policies require the tables to exist first
   - Functions may reference tables from earlier migrations

3. **Storage Setup**: The `009_storage_bucket.sql` file sets up storage buckets. This can also be run manually in the Supabase dashboard if needed.

4. **Dry Run**: Test migrations first:
   ```bash
   supabase db push --dry-run
   ```

5. **Rollback**: If something goes wrong, you may need to manually rollback in the Supabase dashboard.

## Verification

After pushing, verify in Supabase dashboard:

1. Go to **Database** → **Migrations**
2. Check that all migrations are listed
3. Verify tables exist in **Table Editor**
4. Check RLS policies in **Authentication** → **Policies**

## Troubleshooting

### Error: "Migration already applied"
- Some migrations may have been applied manually
- Use `--include-all` flag: `supabase db push --include-all`

### Error: "Permission denied"
- Ensure you have proper database permissions
- Check your Supabase project access

### Error: "Function already exists"
- Some functions may need to be dropped first
- Check the migration files for `CREATE OR REPLACE` statements

## Next Steps

After pushing migrations:

1. **Set up Storage**: Run storage policies from `supabase/storage/` directory
2. **Seed Data**: Add initial data (roles, super admin, etc.)
3. **Test RLS**: Verify RLS policies work correctly
4. **Configure Environment**: Update `.env` with Supabase credentials

