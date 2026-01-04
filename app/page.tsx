/**
 * Root Page
 * 
 * Redirects authenticated users to their dashboard,
 * or shows login for unauthenticated users.
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function HomePage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');
  const userRoles = headersList.get('x-user-roles')?.split(',') || [];

  // If user is authenticated, redirect to their dashboard
  if (userId && userRoles.length > 0) {
    // Determine dashboard based on role priority
    if (userRoles.includes('SUPER_ADMIN')) {
      redirect('/super-admin/dashboard');
    } else if (userRoles.includes('INSTITUTE_ADMIN')) {
      redirect('/admin/dashboard');
    } else if (userRoles.includes('TEACHER')) {
      redirect('/teacher/dashboard');
    } else if (userRoles.includes('STUDENT')) {
      redirect('/student/dashboard');
    }
  }

  // Not authenticated, redirect to login
  redirect('/login');
}

