/**
 * Verify that the current user is a SUPER_ADMIN
 * 
 * This function checks the database to ensure the user has SUPER_ADMIN role.
 * Used to authorize SUPER_ADMIN-only operations.
 */
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function verifySuperAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select(`
      role_id,
      roles!inner(name)
    `)
    .eq('user_id', userId)
    .eq('roles.name', 'SUPER_ADMIN')
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    return false;
  }

  return true;
}

/**
 * Get current user ID from Supabase session
 * Returns null if no authenticated user
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user.id;
}

