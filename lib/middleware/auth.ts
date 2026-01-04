/**
 * Authentication and Authorization Middleware
 * 
 * Validates Supabase session and checks user roles.
 * Includes caching to avoid excessive database queries.
 */

import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface UserSession {
  userId: string;
  email: string;
  instituteId: string | null;
  roles: string[];
  mustChangePassword: boolean;
  cachedAt: number;
}

// In-memory cache for user sessions
// In production, consider using Redis or similar
const sessionCache = new Map<string, UserSession>();

// Cache TTL: 2 minutes (shorter than institute cache since user data changes more frequently)
const SESSION_CACHE_TTL = 2 * 60 * 1000;

/**
 * Get Supabase client for middleware
 * Uses anon key since we're validating session, not bypassing RLS
 */
function getSupabaseClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Validate Supabase session and get user info
 * 
 * Returns user session data including roles and institute.
 * Returns null if session is invalid.
 */
export async function validateSession(
  accessToken: string
): Promise<UserSession | null> {
  if (!accessToken) {
    return null;
  }
  
  // Check cache first
  const cached = sessionCache.get(accessToken);
  if (cached) {
    const age = Date.now() - cached.cachedAt;
    if (age < SESSION_CACHE_TTL) {
      return cached;
    }
    // Cache expired
    sessionCache.delete(accessToken);
  }
  
  try {
    // Validate token with Supabase
    const supabase = getSupabaseClient(accessToken);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return null;
    }
    
    // Get user profile and roles from database
    // Use admin client to bypass RLS for this lookup
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        institute_id,
        must_change_password,
        email
      `)
      .eq('id', user.id)
      .is('deleted_at', null)
      .single();
    
    if (profileError || !profile) {
      return null;
    }
    
    // Get user roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select(`
        roles!inner(name)
      `)
      .eq('user_id', user.id)
      .is('deleted_at', null);
    
    if (rolesError) {
      return null;
    }
    
    const roleNames = roles?.map((r: any) => r.roles.name) || [];
    
    const session: UserSession = {
      userId: user.id,
      email: profile.email,
      instituteId: profile.institute_id,
      roles: roleNames,
      mustChangePassword: profile.must_change_password,
      cachedAt: Date.now(),
    };
    
    // Cache the session
    sessionCache.set(accessToken, session);
    
    return session;
  } catch (error) {
    console.error('Error validating session:', error);
    return null;
  }
}

/**
 * Check if user has a specific role
 */
export function hasRole(session: UserSession, roleName: string): boolean {
  return session.roles.includes(roleName);
}

/**
 * Check if user is SUPER_ADMIN
 */
export function isSuperAdmin(session: UserSession): boolean {
  return hasRole(session, 'SUPER_ADMIN');
}

/**
 * Check if user belongs to a specific institute
 */
export function belongsToInstitute(
  session: UserSession,
  instituteId: string
): boolean {
  // SUPER_ADMIN can access any institute
  if (isSuperAdmin(session)) {
    return true;
  }
  
  return session.instituteId === instituteId;
}

/**
 * Clear session cache (useful after role changes)
 */
export function clearSessionCache(accessToken?: string): void {
  if (accessToken) {
    sessionCache.delete(accessToken);
  } else {
    sessionCache.clear();
  }
}

