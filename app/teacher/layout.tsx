/**
 * Teacher Layout
 * 
 * Layout wrapper for all teacher routes with navigation.
 */

import { DashboardLayout } from '@/components/layouts/dashboard-layout';

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navItems = [
    { name: 'Dashboard', href: '/teacher/dashboard', icon: '📊' },
    { name: 'My Batches', href: '/teacher/batches', icon: '📚' },
    { name: 'Assignments', href: '/teacher/assignments', icon: '📝' },
    { name: 'Attendance', href: '/teacher/attendance', icon: '✅' },
  ];

  return <DashboardLayout navItems={navItems}>{children}</DashboardLayout>;
}

