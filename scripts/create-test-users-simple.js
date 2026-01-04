/**
 * Simple Test Users Creation Script
 * 
 * Usage:
 *   node scripts/create-test-users-simple.js YOUR_SERVICE_ROLE_KEY
 * 
 * Or set environment variable:
 *   SUPABASE_SERVICE_ROLE_KEY=your-key node scripts/create-test-users-simple.js
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.SUPABASE_URL || 
                    'https://urdmaeyxdhmpzepphvlp.supabase.co';

const supabaseServiceKey = process.argv[2] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Missing Supabase Service Role Key');
  console.error('');
  console.error('Usage:');
  console.error('  node scripts/create-test-users-simple.js YOUR_SERVICE_ROLE_KEY');
  console.error('');
  console.error('Or set environment variable:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your-key node scripts/create-test-users-simple.js');
  console.error('');
  console.error('Get your service role key from:');
  console.error('  Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

// Create admin client
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const testUsers = [
  {
    email: 'superadmin@test.com',
    password: 'Test@123456',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'SUPER_ADMIN',
  },
  {
    email: 'admin@test.com',
    password: 'Test@123456',
    firstName: 'Institute',
    lastName: 'Admin',
    role: 'INSTITUTE_ADMIN',
  },
  {
    email: 'teacher@test.com',
    password: 'Test@123456',
    firstName: 'Test',
    lastName: 'Teacher',
    role: 'TEACHER',
  },
  {
    email: 'student@test.com',
    password: 'Test@123456',
    firstName: 'Test',
    lastName: 'Student',
    role: 'STUDENT',
  },
];

async function createTestUsers() {
  console.log('🚀 Creating Test Users...\n');
  console.log(`📡 Connecting to: ${supabaseUrl}\n`);

  // Step 1: Get or create test institute
  console.log('📋 Step 1: Setting up test institute...');
  const { data: institute, error: instituteError } = await supabaseAdmin
    .from('institutes')
    .select('id, name, subdomain')
    .eq('subdomain', 'test')
    .single();

  let instituteId;

  if (instituteError || !institute) {
    console.log('   Creating new test institute...');
    const { data: newInstitute, error: createError } = await supabaseAdmin
      .from('institutes')
      .insert({
        name: 'Test Institute',
        subdomain: 'test',
        status: 'active',
      })
      .select('id, name, subdomain')
      .single();

    if (createError || !newInstitute) {
      console.error('❌ Failed to create institute:', createError?.message);
      process.exit(1);
    }

    instituteId = newInstitute.id;
    console.log(`   ✅ Created institute: ${newInstitute.name} (${newInstitute.subdomain})`);
  } else {
    instituteId = institute.id;
    console.log(`   ✅ Using existing institute: ${institute.name} (${institute.subdomain})`);
  }

  console.log('');

  // Step 2: Get role IDs
  console.log('📋 Step 2: Getting role IDs...');
  const { data: roles, error: rolesError } = await supabaseAdmin
    .from('roles')
    .select('id, name');

  if (rolesError || !roles) {
    console.error('❌ Failed to fetch roles:', rolesError?.message);
    process.exit(1);
  }

  const roleMap = new Map();
  roles.forEach((role) => {
    roleMap.set(role.name, role.id);
  });

  console.log(`   ✅ Found ${roles.length} roles`);
  console.log('');

  // Step 3: Create users
  console.log('📋 Step 3: Creating users...\n');

  for (const user of testUsers) {
    try {
      console.log(`   Creating ${user.role}: ${user.email}...`);

      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          first_name: user.firstName,
          last_name: user.lastName,
        },
      });

      if (authError) {
        if (authError.message?.includes('already registered')) {
          console.log(`   ⚠️  User ${user.email} already exists, updating...`);
          
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = existingUsers?.users.find((u) => u.email === user.email);
          
          if (!existingUser) {
            console.error(`   ❌ Could not find existing user: ${user.email}`);
            continue;
          }

          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            password: user.password,
            user_metadata: {
              first_name: user.firstName,
              last_name: user.lastName,
            },
          });

          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert(
              {
                id: existingUser.id,
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
                institute_id: user.role === 'SUPER_ADMIN' ? null : instituteId,
                must_change_password: false,
                is_active: true,
              },
              { onConflict: 'id' }
            );

          if (profileError) {
            console.error(`   ❌ Failed to update profile: ${profileError.message}`);
            continue;
          }

          const roleId = roleMap.get(user.role);
          if (roleId) {
            const { error: roleError } = await supabaseAdmin
              .from('user_roles')
              .upsert(
                {
                  user_id: existingUser.id,
                  role_id: roleId,
                },
                { onConflict: 'user_id,role_id' }
              );

            if (roleError) {
              console.error(`   ❌ Failed to assign role: ${roleError.message}`);
            } else {
              console.log(`   ✅ Updated user: ${user.email} (${user.role})`);
            }
          }

          continue;
        }

        console.error(`   ❌ Failed to create auth user: ${authError.message}`);
        continue;
      }

      if (!authUser?.user) {
        console.error(`   ❌ No user returned from auth creation`);
        continue;
      }

      // Create profile
      const { error: profileError } = await supabaseAdmin.from('profiles').insert({
        id: authUser.user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        institute_id: user.role === 'SUPER_ADMIN' ? null : instituteId,
        must_change_password: false,
        is_active: true,
      });

      if (profileError) {
        console.error(`   ❌ Failed to create profile: ${profileError.message}`);
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        continue;
      }

      // Assign role
      const roleId = roleMap.get(user.role);
      if (!roleId) {
        console.error(`   ❌ Role not found: ${user.role}`);
        continue;
      }

      const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
        user_id: authUser.user.id,
        role_id: roleId,
      });

      if (roleError) {
        console.error(`   ❌ Failed to assign role: ${roleError.message}`);
      } else {
        console.log(`   ✅ Created user: ${user.email} (${user.role})`);
      }
    } catch (error) {
      console.error(`   ❌ Error creating ${user.email}:`, error.message);
    }
  }

  console.log('\n✅ Test users setup complete!\n');
  console.log('📋 Login Credentials:');
  console.log('========================================');
  testUsers.forEach((user) => {
    console.log(`${user.role}:`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Password: ${user.password}`);
    console.log(`  Subdomain: ${user.role === 'SUPER_ADMIN' ? 'main' : 'test'}`);
    console.log('');
  });
  console.log('========================================');
}

createTestUsers().catch((error) => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});

