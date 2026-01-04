/**
 * Supabase Server Client (with RLS)
 * 
 * This client respects RLS policies and is used for regular operations.
 * Use this for operations that should be subject to RLS enforcement.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.types';
import { getAuthCookieDomain } from '@/lib/supabase/cookie-domain';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const cookieDomain = getAuthCookieDomain();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                ...(cookieDomain ? { domain: cookieDomain } : {}),
              });
            });
          } catch (error) {
            // Cookie setting can fail in middleware, ignore
          }
        },
      },
    }
  );
}

