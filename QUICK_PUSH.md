# Quick Start: Push Migrations to Supabase

## 🚀 Fastest Way to Push All Migrations

### If you have a Supabase Project Reference:

```bash
# 1. Link your project
supabase link --project-ref YOUR_PROJECT_REF

# 2. Push all migrations
supabase db push
```

### If you have Database Connection String:

```bash
# Push directly using connection string
supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
```

### If using Local Development:

```bash
# Start local Supabase (requires Docker)
supabase start

# Push to local
supabase db push --local
```

## 📋 Migration Checklist

Before pushing, ensure:

- [ ] All 16 migration files are in `supabase/migrations/` directory
- [ ] Files are named correctly (001, 002, 003, etc.)
- [ ] You have database admin access
- [ ] Backup your database (if production)

## 📁 Migration Files (16 total)

1. ✅ `001_core_foundation.sql` - Core database structure
2. ✅ `002_rls_policies.sql` - Row Level Security policies
3. ✅ `003_academic_structure.sql` - Courses & batches
4. ✅ `004_academic_rls_policies.sql` - Academic RLS
5. ✅ `005_content_structure.sql` - Modules & lessons
6. ✅ `006_content_rls_policies.sql` - Content RLS
7. ✅ `007_lesson_progress.sql` - Progress tracking
8. ✅ `008_lesson_progress_rls.sql` - Progress RLS
9. ✅ `009_assignments_structure.sql` - Assignments
10. ✅ `010_assignments_rls.sql` - Assignments RLS
11. ✅ `011_attendance_structure.sql` - Attendance
12. ✅ `012_attendance_rls.sql` - Attendance RLS
13. ✅ `013_certificates_structure.sql` - Certificates
14. ✅ `014_certificates_rls.sql` - Certificates RLS
15. ✅ `015_dashboard_functions.sql` - Analytics functions
16. ✅ `009_storage_bucket.sql` - Storage setup

## 🔍 Verify After Push

```bash
# Check migration status
supabase migration list

# Or check in Supabase Dashboard:
# Database → Migrations
```

## ⚠️ Important Notes

1. **Order Matters**: Migrations run in alphabetical order
2. **Dependencies**: RLS migrations depend on table migrations
3. **Storage**: Run storage policies separately from `supabase/storage/` directory
4. **Functions**: Some functions use `SECURITY DEFINER` - review permissions

## 🆘 Troubleshooting

**Error: "Migration already exists"**
```bash
supabase db push --include-all
```

**Error: "Permission denied"**
- Check your Supabase project access
- Verify database password is correct

**Error: "Function already exists"**
- Migrations use `CREATE OR REPLACE` - should be safe
- If issues persist, manually drop and recreate

## 📞 Need Help?

1. Check `PUSH_MIGRATIONS_GUIDE.md` for detailed instructions
2. Review migration files for specific requirements
3. Check Supabase logs in dashboard

