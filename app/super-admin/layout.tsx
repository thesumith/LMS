/**
 * Super Admin Layout
 * 
 * Layout wrapper for all super admin routes with navigation.
 * Super admin routes don't require institute context.
 */

import { DashboardLayout } from '@/components/layouts/dashboard-layout';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navItems = [
    { name: 'Dashboard', href: '/super-admin/dashboard', icon: '📊' },
    { name: 'Institutes', href: '/super-admin/institutes', icon: '🏢' },
  ];

  return <DashboardLayout navItems={navItems}>{children}</DashboardLayout>;
}

