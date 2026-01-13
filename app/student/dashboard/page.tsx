/**
 * Student Dashboard
 * 
 * Server Component for displaying student analytics.
 * All data fetching happens server-side with RLS enforcement.
 */

import { headers } from 'next/headers';
import { getStudentDashboard } from '@/lib/data/student-dashboard';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function StudentDashboardPage() {
  const headersList = await headers();
  const instituteId = headersList.get('x-institute-id');
  const userId = headersList.get('x-user-id');

  if (!instituteId || !userId) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-2xl font-semibold mb-4 text-red-900">Access Denied</h1>
            <p className="text-gray-700">Institute context or authentication required.</p>
          </div>
        </div>
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

  // Upcoming classes (RLS enforced)
  const supabase = await createSupabaseServerClient();
  const { data: upcomingClasses } = await supabase
    .from('class_sessions')
    .select(
      `
      id,
      title,
      scheduled_at,
      duration_minutes,
      meeting_link,
      is_cancelled,
      batches(name),
      courses(name, code)
    `
    )
    .eq('institute_id', instituteId)
    .is('deleted_at', null)
    .eq('is_cancelled', false)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-4 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-1 md:mb-2">My Dashboard</h1>
        <p className="text-sm md:text-base text-gray-600">Welcome back! Here&apos;s your learning overview</p>
      </div>

      {/* Statistics - Horizontal scroll on mobile, grid on larger screens */}
      <div className="-mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 overflow-x-auto pb-2 md:pb-0 md:overflow-visible horizontal-scroll md:flex-wrap">
          <StatCard
            title="Enrolled Courses"
            value={dashboard.enrolledCoursesCount}
            icon={
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
            color="blue"
          />
          <StatCard
            title="Overall Progress"
            value={`${dashboard.totalProgressPercentage.toFixed(1)}%`}
            icon={
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            color="purple"
          />
          <StatCard
            title="Certificates"
            value={dashboard.certificatesCount}
            icon={
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            }
            color="amber"
          />
          <StatCard
            title="Attendance"
            value={`${(dashboard.attendanceSummary.attendance_percentage || 0).toFixed(1)}%`}
            icon={
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color="green"
          />
        </div>
      </div>

      {/* Upcoming Classes */}
      {(upcomingClasses || []).length > 0 && (
        <div className="bg-white rounded-xl md:rounded-lg border border-gray-200 shadow-sm overflow-hidden card-pressable">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-base md:text-lg font-semibold text-gray-900">Upcoming Classes</h2>
              <p className="text-xs md:text-sm text-gray-600 mt-0.5">Join directly from here</p>
            </div>
            <Link href="/student/classes" className="text-sm text-blue-600 hover:text-blue-900 font-medium touch-target flex items-center">
              View All
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {(upcomingClasses || []).map((c: any) => (
              <div key={c.id} className="px-4 md:px-6 py-3 md:py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                {/* Mobile: Stacked layout */}
                <div className="md:hidden space-y-2">
                  <p className="text-sm font-medium text-gray-900">{c.title}</p>
                  <p className="text-xs text-gray-500">
                    {(() => {
                      const course = Array.isArray(c.courses) ? c.courses[0] : c.courses;
                      const batch = Array.isArray(c.batches) ? c.batches[0] : c.batches;
                      return `${course?.name || '—'} • ${batch?.name || '—'}`;
                    })()}
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-gray-600">
                      {new Date(c.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <a
                      href={c.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:bg-blue-800 touch-target"
                    >
                      Join
                    </a>
                  </div>
                </div>
                {/* Desktop: Side by side */}
                <div className="hidden md:flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {(() => {
                        const course = Array.isArray(c.courses) ? c.courses[0] : c.courses;
                        const batch = Array.isArray(c.batches) ? c.batches[0] : c.batches;
                        return (
                          <>
                            {course?.code ? `${course.code} — ` : ''}
                            {course?.name || '—'} • {batch?.name || '—'}
                          </>
                        );
                      })()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(c.scheduled_at).toLocaleString()}
                    </p>
                    <div className="mt-2 flex items-center justify-end gap-3">
                      <Link href={`/student/classes/${c.id}`} className="text-sm text-gray-700 hover:text-gray-900 font-medium">
                        Materials
                      </Link>
                      <a
                        href={c.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                      >
                        Join
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Exams */}
      {dashboard.upcomingExams.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Exams</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {dashboard.upcomingExams.map((exam) => (
              <div
                key={exam.id}
                className="px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{exam.title}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {exam.course_name} - {exam.batch_name}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(exam.exam_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Assignments */}
      <div className="bg-white rounded-xl md:rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base md:text-lg font-semibold text-gray-900">Upcoming Assignments</h2>
              <p className="text-xs md:text-sm text-gray-600 mt-0.5">Assignments that need your attention</p>
            </div>
            <Link
              href="/student/assignments"
              className="text-sm text-blue-600 hover:text-blue-900 font-medium touch-target flex items-center"
            >
              View All
            </Link>
          </div>
        </div>
        {dashboard.recentAssignments.length === 0 ? (
          <div className="px-4 md:px-6 py-10 md:py-12 text-center">
            <svg className="mx-auto h-10 w-10 md:h-12 md:w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No upcoming assignments</h3>
            <p className="mt-1 text-xs md:text-sm text-gray-500">You&apos;re all caught up!</p>
          </div>
        ) : (
          <>
            {/* Mobile: Card layout */}
            <div className="md:hidden divide-y divide-gray-200">
              {dashboard.recentAssignments.map((assignment) => (
                <div key={assignment.id} className="px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{assignment.title}</p>
                      <p className="text-xs text-gray-500 mt-1 truncate">{assignment.course_name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Due: {new Date(assignment.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {assignment.submitted ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop: Table layout */}
            <div className="hidden md:block overflow-x-auto">
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
                    <tr key={assignment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{assignment.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{assignment.course_name} - {assignment.batch_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(assignment.due_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {assignment.submitted ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Submitted
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Attendance Summary */}
      <div className="bg-white rounded-xl md:rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200">
          <h2 className="text-base md:text-lg font-semibold text-gray-900">Attendance (30 Days)</h2>
        </div>
        <div className="px-4 md:px-6 py-4 md:py-6">
          <div className="grid grid-cols-4 gap-2 md:gap-4">
            <div className="text-center p-2 md:p-0">
              <p className="text-xl md:text-3xl font-semibold text-gray-900">{dashboard.attendanceSummary.total_sessions}</p>
              <p className="text-xs md:text-sm text-gray-600 mt-1">Total</p>
            </div>
            <div className="text-center p-2 md:p-0">
              <p className="text-xl md:text-3xl font-semibold text-green-600">
                {dashboard.attendanceSummary.present_count}
              </p>
              <p className="text-xs md:text-sm text-gray-600 mt-1">Present</p>
            </div>
            <div className="text-center p-2 md:p-0">
              <p className="text-xl md:text-3xl font-semibold text-red-600">
                {dashboard.attendanceSummary.absent_count}
              </p>
              <p className="text-xs md:text-sm text-gray-600 mt-1">Absent</p>
            </div>
            <div className="text-center p-2 md:p-0">
              <p className="text-xl md:text-3xl font-semibold text-yellow-600">
                {dashboard.attendanceSummary.late_count}
              </p>
              <p className="text-xs md:text-sm text-gray-600 mt-1">Late</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'indigo' | 'purple' | 'orange' | 'red' | 'teal' | 'pink' | 'amber' | 'gray';
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    teal: 'bg-teal-50 text-teal-600',
    pink: 'bg-pink-50 text-pink-600',
    amber: 'bg-amber-50 text-amber-600',
    gray: 'bg-gray-50 text-gray-600',
  };

  return (
    <div className="bg-white rounded-xl md:rounded-lg border border-gray-200 shadow-sm p-4 md:p-6 hover:shadow-md transition-shadow card-pressable min-w-[140px] md:min-w-0 flex-shrink-0 md:flex-shrink">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm font-medium text-gray-600 mb-0.5 md:mb-1 truncate">{title}</p>
          <p className="text-xl md:text-3xl font-semibold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        </div>
        <div className={`flex-shrink-0 p-2 md:p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
