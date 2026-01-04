/**
 * Teacher Dashboard
 * 
 * Server Component for displaying teacher analytics.
 * All data fetching happens server-side with RLS enforcement.
 */

import { headers } from 'next/headers';
import { getTeacherDashboard } from '@/lib/data/teacher-dashboard';

export default async function TeacherDashboardPage() {
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
    dashboard = await getTeacherDashboard(userId, instituteId);
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
      <h1 className="text-3xl font-bold">Teacher Dashboard</h1>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Assigned Batches"
          value={dashboard.assignedBatchesCount}
          icon="📚"
        />
        <StatCard
          title="Total Students"
          value={dashboard.totalStudents}
          icon="👥"
        />
        <StatCard
          title="Pending Evaluations"
          value={dashboard.pendingEvaluations}
          icon="📝"
          highlight={dashboard.pendingEvaluations > 0}
        />
        <StatCard
          title="Avg Progress"
          value={`${dashboard.averageProgressPercentage.toFixed(1)}%`}
          icon="📊"
        />
      </div>

      {/* Recent Submissions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Submissions</h2>
        {dashboard.recentSubmissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assignment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Marks
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dashboard.recentSubmissions.map((submission) => (
                  <tr key={submission.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {submission.assignment_title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {submission.student_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(submission.submitted_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {submission.is_late ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Late
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          On Time
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {submission.marks !== null ? (
                        <span className="font-semibold">{submission.marks}</span>
                      ) : (
                        <span className="text-gray-400">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No recent submissions.</p>
        )}
      </div>

      {/* Upcoming Sessions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Upcoming Attendance Sessions</h2>
        {dashboard.upcomingSessions.length > 0 ? (
          <div className="space-y-3">
            {dashboard.upcomingSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <p className="font-medium">
                    {session.title || 'Attendance Session'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {session.course_name} - {session.batch_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {new Date(session.session_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No upcoming sessions.</p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  highlight = false,
}: {
  title: string;
  value: string | number;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow p-6 ${
        highlight ? 'ring-2 ring-yellow-400' : ''
      }`}
    >
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

