/**
 * List all users with their IDs, emails, and passwords (where known)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Known passwords from test user creation scripts
const knownPasswords: Record<string, string> = {
  'superadmin@test.com': 'Test@123456',
  'admin@test.com': 'Test@123456',
  'teacher@test.com': 'Test@123456',
  'student@test.com': 'Test@123456',
};

async function listUsersWithPasswords() {
  console.log('👥 Listing all users with passwords...\n');

  try {
    // Get all auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      return;
    }

    if (!authUsers?.users || authUsers.users.length === 0) {
      console.log('No users found.');
      return;
    }

    // Get profiles and roles for each user
    const usersWithDetails = await Promise.all(
      authUsers.users.map(async (authUser) => {
        // Get profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, institute_id, must_change_password, is_active')
          .eq('id', authUser.id)
          .single();

        // Get roles
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role_name')
          .eq('user_id', authUser.id)
          .is('deleted_at', null);

        // Get institute name if applicable
        let instituteName = null;
        if (profile?.institute_id) {
          const { data: institute } = await supabase
            .from('institutes')
            .select('name, subdomain')
            .eq('id', profile.institute_id)
            .single();
          instituteName = institute ? `${institute.name} (${institute.subdomain})` : null;
        }

        return {
          id: authUser.id,
          email: authUser.email || 'N/A',
          firstName: profile?.first_name || null,
          lastName: profile?.last_name || null,
          roles: roles?.map((r: any) => r.role_name) || [],
          institute: instituteName,
          mustChangePassword: profile?.must_change_password || false,
          isActive: profile?.is_active ?? true,
          password: knownPasswords[authUser.email || ''] || '❓ Unknown (not in test users)',
        };
      })
    );

    console.log(`Found ${usersWithDetails.length} users:\n`);
    console.log('═'.repeat(100));

    usersWithDetails.forEach((user, index) => {
      const name = user.firstName || user.lastName 
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
        : '—';
      
      console.log(`\n${index + 1}. User Details:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${name}`);
      console.log(`   Roles: ${user.roles.join(', ') || 'None'}`);
      console.log(`   Institute: ${user.institute || 'N/A'}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Status: ${user.isActive ? '✅ Active' : '❌ Inactive'}`);
      console.log(`   Must Change Password: ${user.mustChangePassword ? '⚠️  Yes' : '✅ No'}`);
    });

    console.log('\n' + '═'.repeat(100));
    console.log('\n📝 Summary:');
    console.log('   • Test users (superadmin@test.com, admin@test.com, teacher@test.com, student@test.com)');
    console.log('     all use password: Test@123456');
    console.log('   • Other users may have different passwords set during creation');
    console.log('   • To reset a password, use Supabase Admin or password reset feature');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

listUsersWithPasswords()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });



