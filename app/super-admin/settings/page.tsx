/**
 * Super Admin Settings Page (Platform)
 *
 * Referenced in docs; keep as a minimal placeholder until platform settings
 * are defined (billing, domains, email, security policies, etc).
 */

import Link from 'next/link';

export default function SuperAdminSettingsPage() {
  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Platform Settings</h1>
        <p className="text-gray-600">Configure global platform behavior.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900">Not configured yet</h2>
        <p className="mt-2 text-sm text-gray-600">
          This page is scaffolded to prevent 404s. Add platform-level settings here when ready.
        </p>

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
            Institutes
          </Link>
        </div>
      </div>
    </div>
  );
}


