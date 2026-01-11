/**
 * Next.js Middleware
 * 
 * Handles:
 * - Subdomain-based tenant resolution
 * - Institute validation
 * - Authentication enforcement
 * - Role-based route guards
 * - Password change enforcement
 * 
 * This middleware runs on every request (except static assets).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { extractSubdomain, isReservedSubdomain } from '@/lib/middleware/subdomain';
import { getInstituteBySubdomain, getInstituteSubdomainById } from '@/lib/middleware/institute';
import { validateSession, isSuperAdmin, belongsToInstitute } from '@/lib/middleware/auth';
import { extractAccessToken } from '@/lib/middleware/token';
import {
  canAccessRoute,
  getUnauthorizedRedirect,
  PUBLIC_ROUTES,
} from '@/lib/middleware/routes';

/**
 * Middleware configuration
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';
  
  // Step 1: Extract subdomain
  const subdomainInfo = extractSubdomain(host);
  
  // Step 2: Handle main domain (platform-level routes)
  if (subdomainInfo.isMainDomain) {
    // Main domain routes (e.g., /login, /super-admin)
    // These don't require institute context
    
    // Get session if available
    const accessToken = extractAccessToken(request);
    const session = accessToken ? await validateSession(accessToken) : null;
    
    // Check route access
    const access = canAccessRoute(pathname, session);
    
    if (!access.allowed) {
      const redirectUrl = getUnauthorizedRedirect(pathname, access.reason || 'not_authenticated');
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    
    // Check password change requirement
    if (session && session.mustChangePassword && pathname !== '/change-password') {
      return NextResponse.redirect(new URL('/change-password', request.url));
    }

    // If an institute-scoped user hits institute routes on the main domain,
    // redirect them to their tenant subdomain automatically.
    // This avoids the "Access Denied: institute context required" dead-end.
    const isInstituteScopedRoute =
      pathname.startsWith('/admin') ||
      pathname.startsWith('/teacher') ||
      pathname.startsWith('/student');

    if (session && !isSuperAdmin(session) && isInstituteScopedRoute && session.instituteId) {
      const tenantSubdomain = await getInstituteSubdomainById(session.instituteId);
      if (tenantSubdomain) {
        const currentUrl = new URL(request.url);
        const port = currentUrl.port ? `:${currentUrl.port}` : '';
        const target = `${currentUrl.protocol}//${tenantSubdomain}.${currentUrl.hostname}${port}${pathname}${currentUrl.search}`;
        return NextResponse.redirect(new URL(target));
      }
    }
    
    // Inject user context headers for main domain routes (e.g., super-admin)
    const requestHeaders = new Headers(request.headers);
    if (session) {
      requestHeaders.set('x-user-id', session.userId);
      requestHeaders.set('x-user-email', session.email);
      requestHeaders.set('x-user-roles', session.roles.join(','));
    }
    
    // Allow access - no institute context needed for main domain
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }
  
  // Step 3: Handle subdomain (tenant routes)
  const subdomain = subdomainInfo.subdomain;
  
  if (!subdomain) {
    // Invalid subdomain format - redirect to main domain home
    const currentUrl = new URL(request.url);
    const hostnameParts = currentUrl.hostname.split('.');
    const isLocalhost = hostnameParts.includes('localhost') || hostnameParts.includes('127.0.0.1');
    const mainHostname = isLocalhost ? 'localhost' : hostnameParts.slice(-2).join('.');
    const mainDomainUrl = `${currentUrl.protocol}//${mainHostname}${currentUrl.port ? `:${currentUrl.port}` : ''}/`;
    return NextResponse.redirect(new URL(mainDomainUrl));
  }
  
  // Check if subdomain is reserved
  if (isReservedSubdomain(subdomain)) {
    // Redirect to main domain to avoid infinite loop
    const currentUrl = new URL(request.url);
    // Extract main domain by removing subdomain prefix
    const hostnameParts = currentUrl.hostname.split('.');
    const isLocalhost = hostnameParts.includes('localhost') || hostnameParts.includes('127.0.0.1');
    const mainHostname = isLocalhost ? 'localhost' : hostnameParts.slice(-2).join('.');
    const mainDomainUrl = `${currentUrl.protocol}//${mainHostname}${currentUrl.port ? `:${currentUrl.port}` : ''}/`;
    return NextResponse.redirect(new URL(mainDomainUrl));
  }
  
  // Step 4: Validate institute
  const institute = await getInstituteBySubdomain(subdomain);
  
  if (!institute) {
    // Institute doesn't exist or is suspended
    return NextResponse.redirect(new URL('/institute-not-found', request.url));
  }
  
  // Step 5: Get authentication session
  const accessToken = extractAccessToken(request);
  const session = accessToken ? await validateSession(accessToken) : null;
  
  // Step 6: Enforce authentication (except for public routes)
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  
  if (!isPublicRoute && !session) {
    // Not authenticated - redirect to login with subdomain
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // Step 7: Check password change requirement
  if (session && session.mustChangePassword && pathname !== '/change-password') {
    return NextResponse.redirect(new URL('/change-password', request.url));
  }
  
  // Step 8: Validate institute access
  if (session && !isSuperAdmin(session)) {
    // Non-SUPER_ADMIN users must belong to this institute
    if (!belongsToInstitute(session, institute.id)) {
      // User doesn't belong to this institute
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }
  
  // Step 9: Check route access based on roles
  if (session) {
    const access = canAccessRoute(pathname, session);
    
    if (!access.allowed) {
      const redirectUrl = getUnauthorizedRedirect(pathname, access.reason || 'insufficient_permissions');
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
  }
  
  // Step 10: Inject institute context into request headers
  // This allows server components and API routes to access institute info
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-institute-id', institute.id);
  requestHeaders.set('x-institute-subdomain', subdomain);
  requestHeaders.set('x-institute-status', institute.status);
  
  // Also inject user context if available
  if (session) {
    requestHeaders.set('x-user-id', session.userId);
    requestHeaders.set('x-user-email', session.email);
    requestHeaders.set('x-user-roles', session.roles.join(','));
  }
  
  // Step 11: Create response with modified headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  return response;
}

