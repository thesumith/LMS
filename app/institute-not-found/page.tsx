/**
 * Institute Not Found (Main Domain)
 *
 * Shown when a tenant subdomain doesn't map to an active institute.
 * Kept public so unauthenticated users can see it.
 */

import Link from 'next/link';

export default function InstituteNotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white border border-gray-200 rounded-lg shadow-sm p-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
            <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Institute not found</h1>
        </div>

        <p className="mt-4 text-gray-600">
          The institute you’re trying to access doesn’t exist or is currently suspended.
          Please verify the subdomain or contact your institute administrator.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            href="/login"
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Go to login
          </Link>
          <Link
            href="/"
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}


