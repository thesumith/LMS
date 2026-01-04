/**
 * Institute Admin Dashboard
 * 
 * Server Component for displaying institute admin analytics.
 * All data fetching happens server-side with RLS enforcement.
 */

import { headers } from 'next/headers';
import { getInstituteAdminDashboard } from '@/lib/data/admin-dashboard';
import { getInstituteContext } from '@/lib/middleware/helpers';

export default async function AdminDashboardPage() {
  const headersList = await headers();
  const instituteId = headersList.get('x-institute-id');
  const userId = headersList.get('x-user-id');

  if (!instituteId || !userId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p>Institute context or authentication required.</p>
      </div>
    );
  }

  // Fetch dashboard data (server-side, respects RLS)
  let dashboard;
  try {
    dashboard = await getInstituteAdminDashboard(instituteId);
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
      <h1 className="text-3xl font-bold">Institute Admin Dashboard</h1>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={dashboard.totalStudents}
          icon="👥"
        />
        <StatCard
          title="Total Teachers"
          value={dashboard.totalTeachers}
          icon="👨‍🏫"
        />
        <StatCard
          title="Active Courses"
          value={dashboard.activeCourses}
          icon="📚"
        />
        <StatCard
          title="Active Batches"
          value={dashboard.activeBatches}
          icon="📅"
        />
        <StatCard
          title="Certificates Issued"
          value={dashboard.totalCertificates}
          icon="🎓"
        />
        <StatCard
          title="Avg Attendance"
          value={`${dashboard.averageAttendancePercentage.toFixed(1)}%`}
          icon="✅"
        />
        <StatCard
          title="Completion Rate"
          value={`${dashboard.completionRate.toFixed(1)}%`}
          icon="📊"
        />
      </div>

      {/* Recent Certificates */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Certificates</h2>
        {dashboard.recentCertificates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Certificate Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Issued At
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dashboard.recentCertificates.map((cert) => (
                  <tr key={cert.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                      {cert.certificate_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {cert.student_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {cert.course_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(cert.issued_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No certificates issued yet.</p>
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

