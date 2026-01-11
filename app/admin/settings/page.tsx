/**
 * Admin Settings Page (Institute)
 *
 * This route is referenced in docs; keep it as a minimal, safe page.
 * Any real admin settings should be implemented via secure server routes + RLS.
 */

import Link from 'next/link';
import { headers } from 'next/headers';

export default async function AdminSettingsPage() {
  const h = await headers();
  const instituteId = h.get('x-institute-id');
  const instituteSubdomain = h.get('x-institute-subdomain');

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Institute Settings</h1>
        <p className="text-gray-600">
          Settings for your institute tenant. (This page is scaffolded; add settings modules as needed.)
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900">Tenant Context</h2>
        <dl className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Subdomain</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900">{instituteSubdomain || '—'}</dd>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Institute ID</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900 font-mono">{instituteId || '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900">Next steps</h2>
        <ul className="mt-3 text-sm text-gray-700 space-y-2 list-disc list-inside">
          <li>Add institute profile settings (name/logo/status) via a secure server route.</li>
          <li>Add user management policies (already available under Admin → Users).</li>
          <li>Add domain/subdomain management if needed (platform-level constraints apply).</li>
        </ul>
        <div className="mt-4 flex gap-3">
          <Link
            href="/admin/dashboard"
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Back to dashboard
          </Link>
          <Link
            href="/admin/users"
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Manage users
          </Link>
        </div>
      </div>
    </div>
  );
}


