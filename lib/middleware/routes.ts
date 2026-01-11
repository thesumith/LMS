/**
 * Route Access Control
 * 
 * Defines route guards and access rules based on user roles.
 */

import type { UserSession } from './auth';

export interface RouteGuard {
  path: string;
  requiredRoles: string[];
  allowSuperAdmin?: boolean; // If true, SUPER_ADMIN can access even without specific role
}

/**
 * Route access matrix
 * 
 * Defines which roles can access which routes.
 */
export const ROUTE_GUARDS: RouteGuard[] = [
  {
    path: '/super-admin',
    requiredRoles: ['SUPER_ADMIN'],
    allowSuperAdmin: false, // Only SUPER_ADMIN, no override needed
  },
  {
    path: '/admin',
    requiredRoles: ['INSTITUTE_ADMIN'],
    allowSuperAdmin: true, // SUPER_ADMIN can also access
  },
  {
    path: '/teacher',
    requiredRoles: ['TEACHER'],
    allowSuperAdmin: true,
  },
  {
    path: '/student',
    requiredRoles: ['STUDENT'],
    allowSuperAdmin: true,
  },
];

/**
 * Public routes that don't require authentication
 */
export const PUBLIC_ROUTES = [
  '/login',
  '/auth',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/institute-not-found',
];

/**
 * Check if a path matches a route guard
 */
export function matchesRoute(pathname: string, guard: RouteGuard): boolean {
  return pathname.startsWith(guard.path);
}

/**
 * Check if user can access a route
 */
export function canAccessRoute(
  pathname: string,
  session: UserSession | null
): { allowed: boolean; reason?: string } {
  // Public routes don't require authentication
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return { allowed: true };
  }
  
  // No session = not authenticated
  if (!session) {
    return { allowed: false, reason: 'not_authenticated' };
  }
  
  // Find matching route guard
  const guard = ROUTE_GUARDS.find((g) => matchesRoute(pathname, g));
  
  // If no guard matches, allow access (public route)
  if (!guard) {
    return { allowed: true };
  }
  
  // Check if user has required role
  const hasRequiredRole = guard.requiredRoles.some((role) =>
    session.roles.includes(role)
  );
  
  // Check SUPER_ADMIN override
  const isSuperAdmin = session.roles.includes('SUPER_ADMIN');
  const canOverride = guard.allowSuperAdmin && isSuperAdmin;
  
  if (hasRequiredRole || canOverride) {
    return { allowed: true };
  }
  
  return {
    allowed: false,
    reason: 'insufficient_permissions',
  };
}

/**
 * Get redirect URL for unauthorized access
 */
export function getUnauthorizedRedirect(
  pathname: string,
  reason: string
): string {
  if (reason === 'not_authenticated') {
    // Redirect to login with return URL
    return `/login?redirect=${encodeURIComponent(pathname)}`;
  }
  
  // Insufficient permissions - redirect to dashboard or home
  // Users will see their role-appropriate dashboard
  if (reason === 'insufficient_permissions') {
    // Try to redirect to user's role-based dashboard
    // This will be handled by the middleware based on user's roles
    return '/';
  }
  
  return '/login';
}

