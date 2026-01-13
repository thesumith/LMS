/**
 * Header Component
 * 
 * Mobile-optimized header with hamburger menu, user profile, and notifications.
 */

'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { createSupabaseClient } from '@/lib/supabase/client';
import { useSidebar } from './sidebar-context';
import { ThemeToggle } from '@/components/theme/theme-toggle';

interface HeaderProps {
  userEmail?: string;
  userName?: string;
}

export function Header({ userEmail, userName }: HeaderProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { toggleSidebar, isMobile, openMobileMenu } = useSidebar();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        // Clear client-side session
        const supabase = createSupabaseClient();
        await supabase.auth.signOut();

        // Redirect to login
        router.push('/login');
        router.refresh();
      } else {
        console.error('Logout failed');
        setLoading(false);
      }
    } catch (error) {
      console.error('Logout error:', error);
      setLoading(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside as any);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as any);
    };
  }, [showDropdown]);

  // Generate initials for avatar
  const getInitials = (email?: string, name?: string) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return 'U';
  };

  // Get display name
  const displayName = userName || userEmail?.split('@')[0] || 'User';

  return (
    <header className="bg-white/90 border-b border-gray-200 shadow-sm sticky top-0 z-40 backdrop-blur dark:bg-gray-900/80 dark:border-gray-800 safe-area-top">
      <div className="flex items-center justify-between px-4 md:px-6 h-14 md:h-16">
        {/* Left Section - Hamburger & Title */}
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {/* Mobile Hamburger - Opens Drawer */}
          <button
            onClick={isMobile ? openMobileMenu : toggleSidebar}
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-gray-300 dark:hover:text-gray-100 dark:focus:ring-offset-gray-900 touch-target"
            aria-label="Toggle menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Page Title - Mobile only, shows truncated */}
          <div className="md:hidden flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              Krrch LMS
            </h1>
          </div>
        </div>

        {/* Right Section - User Profile & Actions */}
        <div className="flex items-center space-x-2 md:space-x-4">
          {/* Theme Toggle - Hidden on very small screens */}
          <div className="hidden xs:block">
            <ThemeToggle />
          </div>

          {/* Notifications */}
          <button
            className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 dark:text-gray-300 dark:hover:text-gray-100 touch-target"
            aria-label="Notifications"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900"></span>
          </button>

          {/* User Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-2 md:space-x-3 p-1.5 md:p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 touch-target"
              aria-expanded={showDropdown}
              aria-haspopup="true"
            >
              {/* Avatar */}
              <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {getInitials(userEmail, userName)}
              </div>

              {/* User Info - Hidden on mobile */}
              <div className="hidden lg:block text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{userEmail}</p>
              </div>

              {/* Dropdown Arrow - Hidden on mobile */}
              <svg
                className={`hidden md:block h-4 w-4 text-gray-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu - Bottom sheet on mobile */}
            {showDropdown && (
              <>
                {/* Mobile: Bottom Sheet */}
                <div className="md:hidden">
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40 bg-black/50"
                    onClick={() => setShowDropdown(false)}
                  />

                  {/* Sheet */}
                  <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-lg safe-area-bottom animate-slide-up">
                    <div className="mobile-sheet-handle"></div>

                    {/* User Info Section */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                          {getInitials(userEmail, userName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{displayName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{userEmail}</p>
                        </div>
                      </div>
                    </div>

                    {/* Theme Toggle for Mobile */}
                    <div className="xs:hidden px-6 py-3 border-b border-gray-200 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-200">Theme</span>
                        <ThemeToggle />
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <button
                        className="w-full flex items-center px-6 py-4 text-base text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors dark:text-gray-200 dark:hover:bg-gray-800 touch-target"
                        onClick={() => setShowDropdown(false)}
                      >
                        <svg className="mr-4 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile Settings
                      </button>
                      <button
                        className="w-full flex items-center px-6 py-4 text-base text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors dark:text-gray-200 dark:hover:bg-gray-800 touch-target"
                        onClick={() => setShowDropdown(false)}
                      >
                        <svg className="mr-4 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Preferences
                      </button>
                    </div>

                    {/* Logout Button */}
                    <div className="border-t border-gray-200 dark:border-gray-800 py-2 pb-4">
                      <button
                        onClick={handleLogout}
                        disabled={loading}
                        className="w-full flex items-center px-6 py-4 text-base text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target"
                      >
                        <svg className="mr-4 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {loading ? 'Logging out...' : 'Logout'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Desktop: Standard Dropdown */}
                <div className="hidden md:block">
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowDropdown(false)}
                  />

                  {/* Dropdown Content */}
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20 dark:bg-gray-900 dark:border-gray-800">
                    {/* User Info Section */}
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{displayName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userEmail}</p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      <a
                        href="#"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150 dark:text-gray-200 dark:hover:bg-gray-800"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowDropdown(false);
                        }}
                      >
                        <svg className="mr-3 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile Settings
                      </a>
                      <a
                        href="#"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150 dark:text-gray-200 dark:hover:bg-gray-800"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowDropdown(false);
                        }}
                      >
                        <svg className="mr-3 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Preferences
                      </a>
                    </div>

                    {/* Logout Button */}
                    <div className="border-t border-gray-200 dark:border-gray-800 pt-1">
                      <button
                        onClick={handleLogout}
                        disabled={loading}
                        className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="mr-3 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {loading ? 'Logging out...' : 'Logout'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
