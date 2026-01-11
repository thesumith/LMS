/**
 * Super Admin Users Page (Platform)
 *
 * Referenced in docs, but a full cross-tenant user management UI/API
 * is not implemented yet in this repo.
 */

import Link from 'next/link';

export default function SuperAdminUsersPage() {
  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Platform Users</h1>
        <p className="text-gray-600">
          Cross-institute user management is not implemented yet.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900">What’s next</h2>
        <ul className="mt-3 text-sm text-gray-700 space-y-2 list-disc list-inside">
          <li>Create a secure server route (service-role) to list users across institutes.</li>
          <li>Expose only safe fields (never return passwords; never expose storage paths).</li>
          <li>Add institute-scoped filtering + pagination (required at SaaS scale).</li>
        </ul>

        <div className="mt-4 flex gap-3">
          <Link
            href="/super-admin/dashboard"
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Back to dashboard
          </Link>
          <Link
            href="/super-admin/institutes"
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Manage institutes
          </Link>
        </div>
      </div>
    </div>
  );
}


