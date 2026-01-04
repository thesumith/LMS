/**
 * Supabase Client-Side Client
 * 
 * For use in Client Components only.
 * Handles authentication and session management in the browser.
 * Uses SSR package for proper Next.js cookie handling.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

export function createSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

