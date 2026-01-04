/**
 * Super Admin Dashboard
 * 
 * Server Component for displaying platform-wide analytics.
 * Shows statistics across all institutes.
 */

import { headers } from 'next/headers';
import { getSuperAdminDashboard } from '@/lib/data/super-admin-dashboard';
import { verifySuperAdmin } from '@/lib/auth/verify-super-admin';

export default async function SuperAdminDashboardPage() {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');

  if (!userId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p>Authentication required.</p>
      </div>
    );
  }

  // Verify super admin access
  const isSuperAdmin = await verifySuperAdmin(userId);
  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p>Super admin access required.</p>
      </div>
    );
  }

  // Fetch dashboard data
  let dashboard;
  try {
    dashboard = await getSuperAdminDashboard();
  } catch (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-red-600">
          {error instanceof Error ? error.message : 'Failed to load dashboard'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Platform-wide overview of all institutes and system activity.
        </p>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Institutes"
          value={dashboard.totalInstitutes}
          icon="🏢"
        />
        <StatCard
          title="Active Institutes"
          value={dashboard.activeInstitutes}
          icon="✅"
        />
        <StatCard
          title="Total Users"
          value={dashboard.totalUsers}
          icon="👥"
        />
        <StatCard
          title="Total Students"
          value={dashboard.totalStudents}
          icon="🎓"
        />
        <StatCard
          title="Total Teachers"
          value={dashboard.totalTeachers}
          icon="👨‍🏫"
        />
        <StatCard
          title="Institute Admins"
          value={dashboard.totalInstituteAdmins}
          icon="👔"
        />
        <StatCard
          title="Total Courses"
          value={dashboard.totalCourses}
          icon="📚"
        />
        <StatCard
          title="Total Batches"
          value={dashboard.totalBatches}
          icon="📅"
        />
        <StatCard
          title="Certificates Issued"
          value={dashboard.totalCertificates}
          icon="🎓"
        />
      </div>

      {/* Recent Institutes */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Institutes</h2>
        {dashboard.recentInstitutes.length === 0 ? (
          <p className="text-gray-500">No institutes found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subdomain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dashboard.recentInstitutes.map((institute) => (
                  <tr key={institute.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {institute.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {institute.subdomain}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          institute.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {institute.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(institute.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );
}

