/**
 * Supabase Server Client (with RLS)
 * 
 * This client respects RLS policies and is used for regular operations.
 * Use this for operations that should be subject to RLS enforcement.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAuthCookieDomain } from '@/lib/supabase/cookie-domain';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const cookieDomain = getAuthCookieDomain();

  // NOTE:
  // The repo's `types/database.types.ts` is currently a placeholder and doesn't fully represent the schema.
  // Use an untyped client to keep Next.js build typechecking stable until real generated types are added.
  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }>
        ) {
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

