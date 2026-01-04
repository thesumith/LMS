/**
 * Header Component
 * 
 * Client component for the application header with user info and logout.
 */

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createSupabaseClient } from '@/lib/supabase/client';

interface HeaderProps {
  userEmail?: string;
  userName?: string;
}

export function Header({ userEmail, userName }: HeaderProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center">
          <h1 className="text-xl font-semibold text-gray-900">LMS Platform</h1>
        </div>
        <div className="flex items-center space-x-4">
          {userEmail && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">{userName || userEmail}</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </div>
    </header>
  );
}

