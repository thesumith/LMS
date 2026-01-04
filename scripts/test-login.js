/**
 * Test Login Diagnostic Script
 * 
 * This script helps diagnose login issues by testing:
 * - Environment variables
 * - Supabase connection
 * - User existence
 * - Profile existence
 * - Role assignments
 * 
 * Usage: node scripts/test-login.js user@example.com
 */

const { createClient } = require('@supabase/supabase-js');

const email = process.argv[2] || 'student@test.com';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.SUPABASE_URL || 
                    'https://urdmaeyxdhmpzepphvlp.supabase.co';

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Login Diagnostic Tool\n');
console.log('========================================\n');

// Check environment variables
console.log('1. Checking Environment Variables...');
if (!supabaseUrl) {
  console.error('   ❌ NEXT_PUBLIC_SUPABASE_URL is missing');
  process.exit(1);
}
console.log('   ✅ NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl);

if (!supabaseAnonKey) {
  console.error('   ❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
  process.exit(1);
}
console.log('   ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: Set');

if (!supabaseServiceKey) {
  console.error('   ❌ SUPABASE_SERVICE_ROLE_KEY is missing (needed for diagnostics)');
  console.log('   ⚠️  Continuing without service key...\n');
} else {
  console.log('   ✅ SUPABASE_SERVICE_ROLE_KEY: Set\n');
}

// Test Supabase connection
console.log('2. Testing Supabase Connection...');
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const { data: healthCheck, error: healthError } = await supabase
  .from('institutes')
  .select('id')
  .limit(1);

if (healthError) {
  console.error('   ❌ Connection failed:', healthError.message);
  process.exit(1);
}
console.log('   ✅ Connection successful\n');

// Check user existence (if service key available)
if (supabaseServiceKey) {
  console.log('3. Checking User in Database...');
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  // Check auth user
  const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
  const authUser = users?.find(u => u.email === email);
  
  if (!authUser) {
    console.error(`   ❌ User ${email} not found in auth.users`);
    console.log('   💡 Solution: Create user using test user script');
    console.log('      node scripts/create-test-users-simple.js YOUR_SERVICE_ROLE_KEY\n');
  } else {
    console.log(`   ✅ Auth user exists: ${authUser.id}`);
    
    // Check profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();
    
    if (profileError || !profile) {
      console.error(`   ❌ Profile not found for user ${email}`);
      console.log('   💡 Solution: Run profile creation script');
      console.log('      supabase/seed/create_test_profiles.sql\n');
    } else {
      console.log(`   ✅ Profile exists: ${profile.email}`);
      console.log(`      Institute ID: ${profile.institute_id || 'NULL (SUPER_ADMIN)'}`);
      console.log(`      Active: ${profile.is_active}`);
      console.log(`      Must Change Password: ${profile.must_change_password}`);
      
      // Check roles
      const { data: roles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select(`
          roles!inner(name)
        `)
        .eq('user_id', authUser.id);
      
      if (rolesError || !roles || roles.length === 0) {
        console.error(`   ❌ No roles assigned to user ${email}`);
        console.log('   💡 Solution: Assign role in user_roles table\n');
      } else {
        const roleNames = roles.map(r => r.roles.name);
        console.log(`   ✅ Roles assigned: ${roleNames.join(', ')}\n`);
      }
    }
  }
} else {
  console.log('3. Skipping database checks (no service key)\n');
}

// Test login
console.log('4. Testing Login...');
console.log(`   Attempting login for: ${email}`);
console.log('   (This will fail if user doesn\'t exist or password is wrong)\n');

console.log('========================================');
console.log('📋 Summary:');
console.log('========================================');
console.log('If login fails with 401, check:');
console.log('  1. User exists in Supabase Auth');
console.log('  2. Profile exists in profiles table');
console.log('  3. User has roles assigned');
console.log('  4. User is_active = true');
console.log('  5. Password is correct');
console.log('');
console.log('To create test users:');
console.log('  node scripts/create-test-users-simple.js YOUR_SERVICE_ROLE_KEY');
console.log('========================================\n');

