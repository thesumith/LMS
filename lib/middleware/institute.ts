/**
 * Institute Validation
 * 
 * Validates institute from subdomain and checks status.
 * Includes caching to avoid excessive database queries.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';

interface InstituteCache {
  id: string;
  subdomain: string;
  status: 'active' | 'suspended';
  cachedAt: number;
}

// In-memory cache for institute lookups
// In production, consider using Redis or similar for distributed systems
const instituteCache = new Map<string, InstituteCache>();

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Get institute by subdomain with caching
 * 
 * Returns null if institute doesn't exist or is suspended.
 */
export async function getInstituteBySubdomain(
  subdomain: string
): Promise<{ id: string; status: string } | null> {
  // Check cache first
  const cached = instituteCache.get(subdomain);
  if (cached) {
    const age = Date.now() - cached.cachedAt;
    if (age < CACHE_TTL) {
      // Return cached if not expired
      if (cached.status === 'active') {
        return { id: cached.id, status: cached.status };
      }
      // Suspended institutes are still cached but return null
      return null;
    }
    // Cache expired, remove it
    instituteCache.delete(subdomain);
  }
  
  // Query database
  const { data, error } = await supabaseAdmin
    .from('institutes')
    .select('id, status')
    .eq('subdomain', subdomain.toLowerCase())
    .is('deleted_at', null)
    .single();
  
  if (error || !data) {
    // Institute doesn't exist
    // Cache negative result for shorter time (1 minute)
    instituteCache.set(subdomain, {
      id: '',
      subdomain,
      status: 'suspended',
      cachedAt: Date.now(),
    });
    return null;
  }
  
  // Cache the result
  instituteCache.set(subdomain, {
    id: data.id,
    subdomain,
    status: data.status as 'active' | 'suspended',
    cachedAt: Date.now(),
  });
  
  // Only return if active
  if (data.status === 'active') {
    return { id: data.id, status: data.status };
  }
  
  return null;
}

/**
 * Clear institute cache (useful after updates)
 */
export function clearInstituteCache(subdomain?: string): void {
  if (subdomain) {
    instituteCache.delete(subdomain);
  } else {
    instituteCache.clear();
  }
}

