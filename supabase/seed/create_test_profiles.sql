-- ============================================================================
-- Create Test User Profiles and Assign Roles
-- ============================================================================
-- Run this AFTER creating auth users in Supabase Dashboard
-- This script creates profiles and assigns roles to existing auth users
-- ============================================================================

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
BEGIN
    -- Get or create institute ID
    SELECT id INTO v_institute_id
    FROM institutes
    WHERE subdomain = 'test'
    LIMIT 1;
    
    IF v_institute_id IS NULL THEN
        -- Create test institute if it doesn't exist
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
    
    -- Get user IDs from auth.users
    SELECT id INTO v_super_admin_id FROM auth.users WHERE email = 'superadmin@test.com' LIMIT 1;
    SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@test.com' LIMIT 1;
    SELECT id INTO v_teacher_id FROM auth.users WHERE email = 'teacher@test.com' LIMIT 1;
    SELECT id INTO v_student_id FROM auth.users WHERE email = 'student@test.com' LIMIT 1;
    
    -- Check if users exist
    IF v_super_admin_id IS NULL THEN
        RAISE NOTICE '⚠️  SUPER_ADMIN user not found. Create superadmin@test.com in Authentication first.';
    END IF;
    
    IF v_admin_id IS NULL THEN
        RAISE NOTICE '⚠️  INSTITUTE_ADMIN user not found. Create admin@test.com in Authentication first.';
    END IF;
    
    IF v_teacher_id IS NULL THEN
        RAISE NOTICE '⚠️  TEACHER user not found. Create teacher@test.com in Authentication first.';
    END IF;
    
    IF v_student_id IS NULL THEN
        RAISE NOTICE '⚠️  STUDENT user not found. Create student@test.com in Authentication first.';
    END IF;
    
    -- Create profiles
    IF v_super_admin_id IS NOT NULL THEN
        INSERT INTO profiles (id, email, first_name, last_name, institute_id, must_change_password, is_active)
        VALUES (v_super_admin_id, 'superadmin@test.com', 'Super', 'Admin', NULL, false, true)
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            institute_id = NULL,
            must_change_password = false,
            is_active = true;
        
        -- Assign role
        IF v_super_admin_role_id IS NOT NULL THEN
            INSERT INTO user_roles (user_id, role_id, institute_id, deleted_at)
            VALUES (v_super_admin_id, v_super_admin_role_id, NULL, NULL)
            ON CONFLICT (user_id, role_id, institute_id, deleted_at) DO NOTHING;
        END IF;
        
        RAISE NOTICE '✅ Created SUPER_ADMIN profile and assigned role';
    END IF;
    
    IF v_admin_id IS NOT NULL THEN
        INSERT INTO profiles (id, email, first_name, last_name, institute_id, must_change_password, is_active)
        VALUES (v_admin_id, 'admin@test.com', 'Institute', 'Admin', v_institute_id, false, true)
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            institute_id = v_institute_id,
            must_change_password = false,
            is_active = true;
        
        -- Assign role
        IF v_admin_role_id IS NOT NULL THEN
            INSERT INTO user_roles (user_id, role_id, institute_id, deleted_at)
            VALUES (v_admin_id, v_admin_role_id, v_institute_id, NULL)
            ON CONFLICT (user_id, role_id, institute_id, deleted_at) DO NOTHING;
        END IF;
        
        RAISE NOTICE '✅ Created INSTITUTE_ADMIN profile and assigned role';
    END IF;
    
    IF v_teacher_id IS NOT NULL THEN
        INSERT INTO profiles (id, email, first_name, last_name, institute_id, must_change_password, is_active)
        VALUES (v_teacher_id, 'teacher@test.com', 'Test', 'Teacher', v_institute_id, false, true)
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            institute_id = v_institute_id,
            must_change_password = false,
            is_active = true;
        
        -- Assign role
        IF v_teacher_role_id IS NOT NULL THEN
            INSERT INTO user_roles (user_id, role_id, institute_id, deleted_at)
            VALUES (v_teacher_id, v_teacher_role_id, v_institute_id, NULL)
            ON CONFLICT (user_id, role_id, institute_id, deleted_at) DO NOTHING;
        END IF;
        
        RAISE NOTICE '✅ Created TEACHER profile and assigned role';
    END IF;
    
    IF v_student_id IS NOT NULL THEN
        INSERT INTO profiles (id, email, first_name, last_name, institute_id, must_change_password, is_active)
        VALUES (v_student_id, 'student@test.com', 'Test', 'Student', v_institute_id, false, true)
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            institute_id = v_institute_id,
            must_change_password = false,
            is_active = true;
        
        -- Assign role
        IF v_student_role_id IS NOT NULL THEN
            INSERT INTO user_roles (user_id, role_id, institute_id, deleted_at)
            VALUES (v_student_id, v_student_role_id, v_institute_id, NULL)
            ON CONFLICT (user_id, role_id, institute_id, deleted_at) DO NOTHING;
        END IF;
        
        RAISE NOTICE '✅ Created STUDENT profile and assigned role';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TEST USERS READY!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Login Credentials:';
    RAISE NOTICE '  SUPER_ADMIN: superadmin@test.com / Test@123456';
    RAISE NOTICE '  INSTITUTE_ADMIN: admin@test.com / Test@123456';
    RAISE NOTICE '  TEACHER: teacher@test.com / Test@123456';
    RAISE NOTICE '  STUDENT: student@test.com / Test@123456';
    RAISE NOTICE '';
    RAISE NOTICE 'Subdomain for testing: test';
    RAISE NOTICE '========================================';
    
END $$;

