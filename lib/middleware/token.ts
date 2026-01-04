/**
 * Token Extraction Utilities
 * 
 * Extracts Supabase access tokens from request cookies and headers.
 * Handles Supabase SSR cookie naming conventions.
 */

import type { NextRequest } from 'next/server';

/**
 * Get Supabase project reference from URL
 */
function getSupabaseProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  // Extract project ref from URL: https://<project-ref>.supabase.co
  const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : '';
}

/**
 * Extract access token from request
 * 
 * Checks:
 * 1. Authorization header (Bearer token)
 * 2. Supabase SSR cookies (sb-<project-ref>-auth-token)
 * 3. Legacy cookie names
 */
export function extractAccessToken(request: NextRequest): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }
  
  // Try Supabase SSR cookie format
  const projectRef = getSupabaseProjectRef();
  if (projectRef) {
    // Supabase SSR uses: sb-<project-ref>-auth-token
    const cookieName = `sb-${projectRef}-auth-token`;
    const cookie = request.cookies.get(cookieName);
    
    if (cookie) {
      try {
        // Cookie value is JSON string containing access_token
        const tokenData = JSON.parse(cookie.value);
        if (tokenData.access_token) {
          return tokenData.access_token;
        }
      } catch {
        // Cookie might be just the token
        return cookie.value;
      }
    }
  }
  
  // Try legacy cookie names (fallback)
  const legacyCookies = [
    'sb-access-token',
    'supabase.auth.token',
    'supabase-auth-token',
  ];
  
  for (const cookieName of legacyCookies) {
    const cookie = request.cookies.get(cookieName);
    if (cookie) {
      try {
        const tokenData = JSON.parse(cookie.value);
        if (tokenData.access_token) {
          return tokenData.access_token;
        }
      } catch {
        return cookie.value;
      }
    }
  }
  
  return null;
}

