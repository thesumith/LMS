/**
 * Create Auth Users Only (Skip Database Operations)
 * 
 * Creates auth users via Admin API, skipping database table operations
 * Run this if database permissions are restricted but Auth API works
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.SUPABASE_URL || 
                    'https://urdmaeyxdhmpzepphvlp.supabase.co';

const supabaseServiceKey = process.argv[2] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Missing Supabase Service Role Key');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const testUsers = [
  { email: 'superadmin@test.com', password: 'Test@123456', firstName: 'Super', lastName: 'Admin' },
  { email: 'admin@test.com', password: 'Test@123456', firstName: 'Institute', lastName: 'Admin' },
  { email: 'teacher@test.com', password: 'Test@123456', firstName: 'Test', lastName: 'Teacher' },
  { email: 'student@test.com', password: 'Test@123456', firstName: 'Test', lastName: 'Student' },
];

async function createAuthUsers() {
  console.log('🚀 Creating Auth Users (via Admin API)...\n');

  for (const user of testUsers) {
    try {
      console.log(`   Creating: ${user.email}...`);
      
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          first_name: user.firstName,
          last_name: user.lastName,
        },
      });

      if (error) {
        if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
          console.log(`   ⚠️  ${user.email} already exists, updating password...`);
          
          const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
          const existing = allUsers?.users.find(u => u.email === user.email);
          
          if (existing) {
            await supabaseAdmin.auth.admin.updateUserById(existing.id, {
              password: user.password,
              user_metadata: {
                first_name: user.firstName,
                last_name: user.lastName,
              },
            });
            console.log(`   ✅ Updated: ${user.email}`);
          } else {
            console.log(`   ❌ Could not find existing user: ${user.email}`);
          }
        } else {
          console.log(`   ❌ Error: ${error.message}`);
        }
      } else {
        console.log(`   ✅ Created: ${user.email}`);
      }
    } catch (e) {
      console.log(`   ❌ Exception: ${e.message}`);
    }
  }

  console.log('\n✅ Auth users creation complete!');
  console.log('\n📋 Next Steps:');
  console.log('   1. Run profile creation SQL script to create profiles and assign roles');
  console.log('   2. Or use Supabase Dashboard → SQL Editor to run:');
  console.log('      supabase/seed/create_test_profiles.sql');
  console.log('');
}

createAuthUsers().catch(console.error);

