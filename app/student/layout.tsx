/**
 * Student Layout
 * 
 * Layout wrapper for all student routes with navigation.
 */

import { DashboardLayout } from '@/components/layouts/dashboard-layout';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navItems = [
    { name: 'Dashboard', href: '/student/dashboard', icon: '📊' },
    { name: 'My Courses', href: '/student/courses', icon: '📚' },
    { name: 'Assignments', href: '/student/assignments', icon: '📝' },
    { name: 'Certificates', href: '/student/certificates', icon: '🎓' },
  ];

  return <DashboardLayout navItems={navItems}>{children}</DashboardLayout>;
}

