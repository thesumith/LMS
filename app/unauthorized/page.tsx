/**
 * Unauthorized Page
 *
 * Target for middleware redirects when a user is authenticated but doesn't
 * belong to the requested institute subdomain.
 */

import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white border border-gray-200 rounded-lg shadow-sm p-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Unauthorized</h1>
        </div>

        <p className="mt-4 text-gray-600">
          You don’t have access to this institute. This usually happens when you’re logged in
          to a different tenant and try to open another institute’s subdomain.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Go to my dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Login again
          </Link>
        </div>
      </div>
    </div>
  );
}


