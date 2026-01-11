/**
 * List all users with their IDs, emails, and roles
 * Note: Passwords are hashed and cannot be retrieved
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

async function listUsers() {
  console.log('👥 Listing all users...\n');

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
          email: authUser.email,
          firstName: profile?.first_name || null,
          lastName: profile?.last_name || null,
          roles: roles?.map((r: any) => r.role_name) || [],
          institute: instituteName,
          mustChangePassword: profile?.must_change_password || false,
          isActive: profile?.is_active ?? true,
          emailConfirmed: authUser.email_confirmed_at !== null,
          createdAt: authUser.created_at,
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
      console.log(`   Status: ${user.isActive ? '✅ Active' : '❌ Inactive'}`);
      console.log(`   Email Confirmed: ${user.emailConfirmed ? '✅ Yes' : '❌ No'}`);
      console.log(`   Must Change Password: ${user.mustChangePassword ? '⚠️  Yes' : '✅ No'}`);
      console.log(`   Created: ${new Date(user.createdAt).toLocaleString()}`);
      console.log(`   ⚠️  Password: Cannot be retrieved (hashed for security)`);
    });

    console.log('\n' + '═'.repeat(100));
    console.log('\n📝 Note: Passwords are securely hashed and cannot be retrieved.');
    console.log('   To reset a password, use the password reset feature or update via Supabase Admin.');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

listUsers()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });



