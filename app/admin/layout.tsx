/**
 * Admin Layout
 * 
 * Layout wrapper for all admin routes with navigation.
 */

import { DashboardLayout } from '@/components/layouts/dashboard-layout';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { name: 'Users', href: '/admin/users', icon: '👥' },
    { name: 'Courses', href: '/admin/courses', icon: '📚' },
    { name: 'Batches', href: '/admin/batches', icon: '📅' },
    { name: 'Enrollments', href: '/admin/enrollments', icon: '✅' },
    { name: 'Certificates', href: '/admin/certificates', icon: '🎓' },
  ];

  return <DashboardLayout navItems={navItems}>{children}</DashboardLayout>;
}

