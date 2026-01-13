/**
 * Dashboard Layout
 * 
 * Responsive layout wrapper for dashboard pages with sidebar, header, and mobile optimizations.
 */

import { headers } from 'next/headers';
import { Header } from '@/components/navigation/header';
import { Sidebar } from '@/components/navigation/sidebar';
import { SidebarProvider } from '@/components/navigation/sidebar-context';
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
    <SidebarProvider>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
        <Sidebar items={sidebarItems} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header userEmail={userEmail || undefined} />
          <main className="flex-1 overflow-y-auto scroll-container main-content-area">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
