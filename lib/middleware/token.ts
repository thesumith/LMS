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
        let cookieValue = cookie.value;
        
        // Handle base64 encoded cookie values (Supabase SSR format)
        if (cookieValue.startsWith('base64-')) {
          // Remove 'base64-' prefix and decode
          const base64Data = cookieValue.substring(7); // Remove 'base64-' prefix
          cookieValue = Buffer.from(base64Data, 'base64').toString('utf-8');
        }
        
        // Cookie value is JSON string containing access_token
        const tokenData = JSON.parse(cookieValue);
        if (tokenData.access_token) {
          return tokenData.access_token;
        }
      } catch (error) {
        // If parsing fails, try using the raw value (might be just the token)
        // But first check if it's base64 encoded
        let cookieValue = cookie.value;
        if (cookieValue.startsWith('base64-')) {
          try {
            const base64Data = cookieValue.substring(7);
            cookieValue = Buffer.from(base64Data, 'base64').toString('utf-8');
            const tokenData = JSON.parse(cookieValue);
            if (tokenData.access_token) {
              return tokenData.access_token;
            }
          } catch {
            // Fall through to return raw value
          }
        }
        return cookieValue;
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
        let cookieValue = cookie.value;
        
        // Handle base64 encoded cookie values
        if (cookieValue.startsWith('base64-')) {
          const base64Data = cookieValue.substring(7);
          cookieValue = Buffer.from(base64Data, 'base64').toString('utf-8');
        }
        
        const tokenData = JSON.parse(cookieValue);
        if (tokenData.access_token) {
          return tokenData.access_token;
        }
      } catch {
        // If parsing fails, return raw value
        return cookie.value.startsWith('base64-') 
          ? Buffer.from(cookie.value.substring(7), 'base64').toString('utf-8')
          : cookie.value;
      }
    }
  }
  
  return null;
}

