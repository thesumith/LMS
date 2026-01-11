/**
 * Supabase Admin Client (Service Role)
 * 
 * This client bypasses RLS and should ONLY be used server-side.
 * Never expose the service role key to the client.
 */
import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

// NOTE:
// The repo's `types/database.types.ts` is currently a placeholder and doesn't fully represent the schema.
// Using it here causes widespread `never` inference during Next.js build typechecking.
// Once you generate real types from Supabase, switch this back to `createClient<Database>(...)`.
export const supabaseAdmin = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

