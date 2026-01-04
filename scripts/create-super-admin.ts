/**
 * Create SUPER_ADMIN User Script
 * 
 * This script creates a SUPER_ADMIN user with profile and role assignment.
 * Run with: npx tsx scripts/create-super-admin.ts
 * 
 * Requires:
 * - SUPABASE_SERVICE_ROLE_KEY in environment
 * - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL in environment
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('Usage:');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY="your-key"');
  console.error('  export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"');
  console.error('  npx tsx scripts/create-super-admin.ts');
  process.exit(1);
}

// Create admin client (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const SUPER_ADMIN_EMAIL = 'superadmin@test.com';
const SUPER_ADMIN_PASSWORD = 'Test@123456';
const SUPER_ADMIN_FIRST_NAME = 'Super';
const SUPER_ADMIN_LAST_NAME = 'Admin';

async function createSuperAdmin() {
  console.log('🚀 Creating SUPER_ADMIN User...\n');

  try {
    // Step 1: Get SUPER_ADMIN role ID
    console.log('📋 Step 1: Fetching SUPER_ADMIN role...');
    const { data: role, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id, name')
      .eq('name', 'SUPER_ADMIN')
      .single();

    if (roleError || !role) {
      console.error('❌ Failed to fetch SUPER_ADMIN role:', roleError?.message);
      console.error('   Make sure the roles table has a SUPER_ADMIN role.');
      process.exit(1);
    }

    console.log(`   ✅ Found role: ${role.name} (${role.id})`);
    console.log('');

    // Step 2: Check if user already exists
    console.log('📋 Step 2: Checking for existing user...');
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find((u) => u.email === SUPER_ADMIN_EMAIL);

    let userId: string;

    if (existingUser) {
      console.log(`   ⚠️  User ${SUPER_ADMIN_EMAIL} already exists, updating...`);
      userId = existingUser.id;

      // Update password and metadata
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: SUPER_ADMIN_PASSWORD,
        user_metadata: {
          first_name: SUPER_ADMIN_FIRST_NAME,
          last_name: SUPER_ADMIN_LAST_NAME,
        },
      });

      if (updateError) {
        console.error('   ❌ Failed to update user:', updateError.message);
        process.exit(1);
      }

      console.log('   ✅ Updated existing auth user');
    } else {
      // Step 3: Create auth user
      console.log('📋 Step 3: Creating auth user...');
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: SUPER_ADMIN_FIRST_NAME,
          last_name: SUPER_ADMIN_LAST_NAME,
        },
      });

      if (authError || !authUser.user) {
        console.error('❌ Failed to create auth user:', authError?.message);
        process.exit(1);
      }

      userId = authUser.user.id;
      console.log(`   ✅ Created auth user: ${authUser.user.email} (${userId})`);
    }

    console.log('');

    // Step 4: Create or update profile
    console.log('📋 Step 4: Creating/updating profile...');
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
      {
        id: userId,
        email: SUPER_ADMIN_EMAIL,
        first_name: SUPER_ADMIN_FIRST_NAME,
        last_name: SUPER_ADMIN_LAST_NAME,
        institute_id: null, // SUPER_ADMIN is not tied to an institute
        must_change_password: false,
        is_active: true,
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      console.error('❌ Failed to create/update profile:', profileError.message);
      process.exit(1);
    }

    console.log('   ✅ Profile created/updated');
    console.log('');

    // Step 5: Assign SUPER_ADMIN role
    console.log('📋 Step 5: Assigning SUPER_ADMIN role...');
    const { error: roleAssignmentError } = await supabaseAdmin
      .from('user_roles')
      .upsert(
        {
          user_id: userId,
          role_id: role.id,
          institute_id: null, // SUPER_ADMIN role is not tied to an institute
          deleted_at: null,
        },
        {
          onConflict: 'user_id,role_id,institute_id,deleted_at',
        }
      );

    if (roleAssignmentError) {
      console.error('❌ Failed to assign role:', roleAssignmentError.message);
      process.exit(1);
    }

    console.log('   ✅ Role assigned');
    console.log('');

    // Success message
    console.log('========================================');
    console.log('✅ SUPER_ADMIN USER CREATED SUCCESSFULLY!');
    console.log('========================================');
    console.log('');
    console.log('Login Credentials:');
    console.log(`  Email: ${SUPER_ADMIN_EMAIL}`);
    console.log(`  Password: ${SUPER_ADMIN_PASSWORD}`);
    console.log('');
    console.log('Note: SUPER_ADMIN users are not tied to any institute.');
    console.log('They can access all routes and manage all institutes.');
    console.log('========================================');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the script
createSuperAdmin();

