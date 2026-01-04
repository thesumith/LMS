-- ============================================================================
-- Test Users Setup for Multi-Tenant LMS
-- ============================================================================
-- This script creates test users for all roles
-- Run this in Supabase SQL Editor with service role key
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Test Institute
-- ============================================================================
INSERT INTO institutes (id, name, subdomain, status)
VALUES (
    gen_random_uuid(),
    'Test Institute',
    'test',
    'active'
)
ON CONFLICT (subdomain) DO UPDATE
SET name = EXCLUDED.name,
    status = EXCLUDED.status
RETURNING id, name, subdomain;

-- Get the institute ID (you'll need to replace this with actual ID)
-- For now, we'll use a variable approach
DO $$
DECLARE
    v_institute_id UUID;
    v_super_admin_id UUID;
    v_admin_id UUID;
    v_teacher_id UUID;
    v_student_id UUID;
    v_super_admin_role_id UUID;
    v_admin_role_id UUID;
    v_teacher_role_id UUID;
    v_student_role_id UUID;
    v_temp_password TEXT;
BEGIN
    -- Get or create institute
    SELECT id INTO v_institute_id
    FROM institutes
    WHERE subdomain = 'test'
    LIMIT 1;
    
    IF v_institute_id IS NULL THEN
        INSERT INTO institutes (id, name, subdomain, status)
        VALUES (gen_random_uuid(), 'Test Institute', 'test', 'active')
        RETURNING id INTO v_institute_id;
    END IF;
    
    -- Get role IDs
    SELECT id INTO v_super_admin_role_id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1;
    SELECT id INTO v_admin_role_id FROM roles WHERE name = 'INSTITUTE_ADMIN' LIMIT 1;
    SELECT id INTO v_teacher_role_id FROM roles WHERE name = 'TEACHER' LIMIT 1;
    SELECT id INTO v_student_role_id FROM roles WHERE name = 'STUDENT' LIMIT 1;
    
    -- ============================================================================
    -- STEP 2: Create SUPER_ADMIN User
    -- ============================================================================
    -- Note: This requires Supabase Auth Admin API
    -- You'll need to create this user via Supabase Dashboard or Admin API
    -- For now, we'll create the profile assuming auth user exists
    
    -- Generate temporary password
    v_temp_password := 'Test@123456';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TEST USERS SETUP';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Institute ID: %', v_institute_id;
    RAISE NOTICE 'Institute Subdomain: test';
    RAISE NOTICE '';
    RAISE NOTICE 'To create users, use Supabase Dashboard or Admin API:';
    RAISE NOTICE '';
    RAISE NOTICE '1. SUPER_ADMIN:';
    RAISE NOTICE '   Email: superadmin@test.com';
    RAISE NOTICE '   Password: %', v_temp_password;
    RAISE NOTICE '';
    RAISE NOTICE '2. INSTITUTE_ADMIN:';
    RAISE NOTICE '   Email: admin@test.com';
    RAISE NOTICE '   Password: %', v_temp_password;
    RAISE NOTICE '';
    RAISE NOTICE '3. TEACHER:';
    RAISE NOTICE '   Email: teacher@test.com';
    RAISE NOTICE '   Password: %', v_temp_password;
    RAISE NOTICE '';
    RAISE NOTICE '4. STUDENT:';
    RAISE NOTICE '   Email: student@test.com';
    RAISE NOTICE '   Password: %', v_temp_password;
    RAISE NOTICE '';
    RAISE NOTICE 'After creating auth users, run the profile creation script.';
    RAISE NOTICE '========================================';
    
END $$;

-- ============================================================================
-- NOTE: The above script only sets up the institute
-- You need to create auth users separately via:
-- 1. Supabase Dashboard → Authentication → Add User
-- 2. Or use Supabase Admin API
-- ============================================================================

