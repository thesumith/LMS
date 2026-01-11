/**
 * Quick script to check user counts in the database
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

async function checkUsers() {
  console.log('📊 Checking user counts in database...\n');

  try {
    // Check auth.users count using admin API
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error querying auth.users:', authError);
    } else {
      console.log(`✅ Auth Users (auth.users): ${authUsers?.users?.length || 0}`);
    }

    // Check profiles count
    const { count: profilesCount, error: profilesError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    if (profilesError) {
      console.error('Error querying profiles:', profilesError);
    } else {
      console.log(`✅ Active Profiles: ${profilesCount || 0}`);
    }

    // Check users by role
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('role_name')
      .is('deleted_at', null);

    if (rolesError) {
      console.error('Error querying user_roles:', rolesError);
    } else {
      const roleCounts = (rolesData || []).reduce((acc: Record<string, number>, item: any) => {
        const role = item.role_name;
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {});

      console.log('\n📋 Users by Role:');
      Object.entries(roleCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([role, count]) => {
          console.log(`   ${role}: ${count}`);
        });
    }

    // Check institutes
    const { count: institutesCount, error: institutesError } = await supabase
      .from('institutes')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    if (institutesError) {
      console.error('Error querying institutes:', institutesError);
    } else {
      console.log(`\n🏢 Active Institutes: ${institutesCount || 0}`);
    }

    // List institutes with subdomains
    const { data: institutes, error: institutesListError } = await supabase
      .from('institutes')
      .select('subdomain, status, name')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (institutesListError) {
      console.error('Error listing institutes:', institutesListError);
    } else if (institutes && institutes.length > 0) {
      console.log('\n📝 Institutes:');
      institutes.forEach((inst: any) => {
        console.log(`   - ${inst.subdomain} (${inst.status}): ${inst.name}`);
      });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkUsers()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

