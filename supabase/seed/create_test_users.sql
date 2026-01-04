-- ============================================================================
-- Create Test Users - Complete Setup
-- ============================================================================
-- Run this in Supabase SQL Editor
-- This script creates test institute and sets up user creation instructions
-- ============================================================================

-- Step 1: Ensure default roles exist
INSERT INTO roles (name, description)
VALUES
    ('SUPER_ADMIN', 'Platform super administrator'),
    ('INSTITUTE_ADMIN', 'Institute administrator'),
    ('TEACHER', 'Teacher/Instructor'),
    ('STUDENT', 'Student')
ON CONFLICT (name) DO NOTHING;

-- Step 2: Create test institute
DO $$
DECLARE
    v_institute_id UUID;
    v_super_admin_role_id UUID;
    v_admin_role_id UUID;
    v_teacher_role_id UUID;
    v_student_role_id UUID;
BEGIN
    -- Get or create test institute
    SELECT id INTO v_institute_id
    FROM institutes
    WHERE subdomain = 'test'
    LIMIT 1;
    
    IF v_institute_id IS NULL THEN
        INSERT INTO institutes (id, name, subdomain, status)
        VALUES (gen_random_uuid(), 'Test Institute', 'test', 'active')
        RETURNING id INTO v_institute_id;
        
        RAISE NOTICE '✅ Created test institute: %', v_institute_id;
    ELSE
        RAISE NOTICE '✅ Using existing test institute: %', v_institute_id;
    END IF;
    
    -- Get role IDs
    SELECT id INTO v_super_admin_role_id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1;
    SELECT id INTO v_admin_role_id FROM roles WHERE name = 'INSTITUTE_ADMIN' LIMIT 1;
    SELECT id INTO v_teacher_role_id FROM roles WHERE name = 'TEACHER' LIMIT 1;
    SELECT id INTO v_student_role_id FROM roles WHERE name = 'STUDENT' LIMIT 1;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TEST USERS SETUP INSTRUCTIONS';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Institute ID: %', v_institute_id;
    RAISE NOTICE 'Institute Subdomain: test';
    RAISE NOTICE '';
    RAISE NOTICE 'STEP 1: Create Auth Users in Supabase Dashboard';
    RAISE NOTICE '   Go to: Authentication → Users → Add User';
    RAISE NOTICE '';
    RAISE NOTICE '   Create these users:';
    RAISE NOTICE '   1. superadmin@test.com / Test@123456';
    RAISE NOTICE '   2. admin@test.com / Test@123456';
    RAISE NOTICE '   3. teacher@test.com / Test@123456';
    RAISE NOTICE '   4. student@test.com / Test@123456';
    RAISE NOTICE '';
    RAISE NOTICE 'STEP 2: After creating auth users, run the next script';
    RAISE NOTICE '   (see: supabase/seed/create_test_profiles.sql)';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    
END $$;

