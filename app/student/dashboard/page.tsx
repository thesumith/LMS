/**
 * Student Dashboard
 * 
 * Server Component for displaying student analytics.
 * All data fetching happens server-side with RLS enforcement.
 */

import { headers } from 'next/headers';
import { getStudentDashboard } from '@/lib/data/student-dashboard';

export default async function StudentDashboardPage() {
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
    dashboard = await getStudentDashboard(userId, instituteId);
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
      <h1 className="text-3xl font-bold">My Dashboard</h1>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Enrolled Courses"
          value={dashboard.enrolledCoursesCount}
          icon="📚"
        />
        <StatCard
          title="Overall Progress"
          value={`${dashboard.totalProgressPercentage.toFixed(1)}%`}
          icon="📊"
        />
        <StatCard
          title="Certificates"
          value={dashboard.certificatesCount}
          icon="🎓"
        />
        <StatCard
          title="Attendance (30 days)"
          value={`${dashboard.attendanceSummary.attendance_percentage.toFixed(1)}%`}
          icon="✅"
        />
      </div>

      {/* Upcoming Exams */}
      {dashboard.upcomingExams.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Upcoming Exams</h2>
          <div className="space-y-3">
            {dashboard.upcomingExams.map((exam) => (
              <div
                key={exam.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{exam.title}</p>
                  <p className="text-sm text-gray-600">
                    {exam.course_name} - {exam.batch_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {new Date(exam.exam_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Assignments */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Upcoming Assignments</h2>
        {dashboard.recentAssignments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assignment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dashboard.recentAssignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {assignment.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {assignment.course_name} - {assignment.batch_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(assignment.due_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {assignment.submitted ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Submitted
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No upcoming assignments.</p>
        )}
      </div>

      {/* Attendance Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Attendance Summary (Last 30 Days)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{dashboard.attendanceSummary.total_sessions}</p>
            <p className="text-sm text-gray-600">Total Sessions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {dashboard.attendanceSummary.present_count}
            </p>
            <p className="text-sm text-gray-600">Present</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">
              {dashboard.attendanceSummary.absent_count}
            </p>
            <p className="text-sm text-gray-600">Absent</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {dashboard.attendanceSummary.late_count}
            </p>
            <p className="text-sm text-gray-600">Late</p>
          </div>
        </div>
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
