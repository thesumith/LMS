/**
 * Sidebar Navigation Component
 * 
 * Responsive sidebar with mobile drawer support and bottom navigation.
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { useSidebar } from './sidebar-context';

interface NavItem {
  name: string;
  href: string;
  icon?: string | ReactNode;
}

interface SidebarProps {
  items: NavItem[];
}

// SVG Icon Components
const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const CoursesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const BatchesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const AssignmentsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const AttendanceIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CertificatesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
);

const InstitutesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const GradesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

// Icon mapping function
const getIcon = (iconName: string | ReactNode) => {
  if (typeof iconName !== 'string') return iconName;

  const iconMap: Record<string, ReactNode> = {
    '📊': <DashboardIcon />,
    '👥': <UsersIcon />,
    '📚': <CoursesIcon />,
    '📅': <BatchesIcon />,
    '📝': <AssignmentsIcon />,
    '✅': <AttendanceIcon />,
    '🎓': <CertificatesIcon />,
    '🏢': <InstitutesIcon />,
    '⚙️': <SettingsIcon />,
    '📈': <GradesIcon />,
  };

  return iconMap[iconName] || <DashboardIcon />;
};

export function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();
  const { isCollapsed, isMobileOpen, closeMobileMenu, isMobile } = useSidebar();

  // Close mobile menu when navigating
  useEffect(() => {
    if (isMobile && isMobileOpen) {
      closeMobileMenu();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Desktop sidebar
  const SidebarContent = () => (
    <>
      {/* Logo/Brand Section */}
      <div
        className={`border-b border-gray-200 h-16 flex items-center transition-all duration-300 dark:border-gray-800 ${isCollapsed && !isMobile ? 'px-3' : 'px-6'
          }`}
      >
        <div className={`flex items-center ${isCollapsed && !isMobile ? 'justify-center' : 'space-x-3'}`}>
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 relative">
            <Image
              src="/logo.png"
              alt="Krrch LMS Logo"
              width={40}
              height={40}
              className="object-contain dark:brightness-0 dark:invert"
            />
          </div>
          {(!isCollapsed || isMobile) && (
            <div className="overflow-hidden">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Krrch LMS
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Learning Management</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scroll-container">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed && !isMobile ? item.name : undefined}
              className={`touch-ripple group relative flex items-center ${isCollapsed && !isMobile ? 'justify-center' : 'space-x-3'} ${isCollapsed && !isMobile ? 'px-3' : 'px-3'} py-3 md:py-2.5 rounded-lg transition-colors duration-150 touch-target ${isActive
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                  : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-800 dark:active:bg-gray-700'
                }`}
            >
              {/* Icon */}
              <span
                className={`flex-shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-300' : 'text-gray-600 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-gray-100'
                  }`}
              >
                {item.icon ? getIcon(item.icon) : <DashboardIcon />}
              </span>

              {/* Label */}
              {(!isCollapsed || isMobile) && (
                <span className={`text-sm font-medium whitespace-nowrap ${isActive ? 'text-blue-600 font-semibold dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'
                  }`}>
                  {item.name}
                </span>
              )}

              {/* Tooltip for collapsed state (desktop only) */}
              {isCollapsed && !isMobile && (
                <div className="absolute left-full ml-2 px-2 py-1.5 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 dark:bg-black">
                  {item.name}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {(!isCollapsed || isMobile) && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            <p>© 2026 Krrch LMS</p>
            <p className="mt-1">Multi-Tenant SaaS</p>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`mobile-overlay md:hidden ${isMobileOpen ? 'active' : ''}`}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />

      {/* Mobile Sidebar (Drawer) */}
      <aside
        className={`mobile-sidebar md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-gray-900 flex flex-col safe-area-left ${isMobileOpen ? 'open' : ''
          }`}
      >
        {/* Close button for mobile */}
        <button
          onClick={closeMobileMenu}
          className="absolute top-4 right-4 p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 touch-target"
          aria-label="Close menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <SidebarContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex bg-white border-r border-gray-200 min-h-screen flex-col transition-all duration-300 dark:bg-gray-900 dark:border-gray-800 ${isCollapsed ? 'w-16' : 'w-64'
        }`}>
        <SidebarContent />
      </aside>

      {/* Bottom Navigation for Mobile */}
      <BottomNavigation items={items} />
    </>
  );
}

// Bottom Navigation Component for Mobile
function BottomNavigation({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  // Show only the first 5 items in bottom nav (or 4 + More)
  const visibleItems = items.slice(0, 5);

  return (
    <nav className="bottom-nav md:hidden safe-area-bottom">
      {visibleItems.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center flex-1 py-2 px-1 transition-colors touch-target ${isActive
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'
              }`}
          >
            <span className={`mb-1 ${isActive ? 'scale-110' : ''} transition-transform`}>
              {item.icon ? getIcon(item.icon) : <DashboardIcon />}
            </span>
            <span className={`text-[10px] font-medium truncate max-w-full ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
              }`}>
              {item.name.split(' ')[0]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
