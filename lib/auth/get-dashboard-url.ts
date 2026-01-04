/**
 * Get Dashboard URL Based on User Role
 * 
 * Returns the appropriate dashboard URL for a user based on their roles.
 */

/**
 * Get the dashboard URL for a user based on their roles
 * 
 * Priority order:
 * 1. SUPER_ADMIN → /super-admin/dashboard
 * 2. INSTITUTE_ADMIN → /admin/dashboard
 * 3. TEACHER → /teacher/dashboard
 * 4. STUDENT → /student/dashboard
 */
export function getDashboardUrl(roles: string[]): string {
  // Check roles in priority order
  if (roles.includes('SUPER_ADMIN')) {
    return '/super-admin/dashboard';
  }
  
  if (roles.includes('INSTITUTE_ADMIN')) {
    return '/admin/dashboard';
  }
  
  if (roles.includes('TEACHER')) {
    return '/teacher/dashboard';
  }
  
  if (roles.includes('STUDENT')) {
    return '/student/dashboard';
  }
  
  // Default fallback
  return '/';
}

