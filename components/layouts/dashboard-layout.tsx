/**
 * Dashboard Layout
 * 
 * Shared layout wrapper for dashboard pages with sidebar and header.
 */

import { headers } from 'next/headers';
import { Header } from '@/components/navigation/header';
import { Sidebar } from '@/components/navigation/sidebar';
import { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
  navItems: Array<{ name: string; href: string; icon?: string }>;
}

export async function DashboardLayout({ children, navItems }: DashboardLayoutProps) {
  const headersList = await headers();
  const userEmail = headersList.get('x-user-email');

  // Convert nav items to include icons as ReactNode
  const sidebarItems = navItems.map((item) => ({
    name: item.name,
    href: item.href,
    icon: item.icon,
  }));

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar items={sidebarItems} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userEmail={userEmail || undefined} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

