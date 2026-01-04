/**
 * Student Dashboard Page
 * 
 * Server component that displays student's enrolled batches and progress.
 * Uses RLS to automatically filter data.
 */

import { getStudentDashboard } from '@/lib/data/student-dashboard';
import { redirect } from 'next/navigation';

export default async function StudentDashboardPage() {
  try {
    const dashboardData = await getStudentDashboard();

    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">My Dashboard</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Batches</h3>
            <p className="text-2xl font-bold mt-2">{dashboardData.summary.totalBatches}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Active Batches</h3>
            <p className="text-2xl font-bold mt-2">{dashboardData.summary.activeBatches}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Courses</h3>
            <p className="text-2xl font-bold mt-2">{dashboardData.summary.totalCourses}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Average Progress</h3>
            <p className="text-2xl font-bold mt-2">
              {dashboardData.summary.averageProgress}%
            </p>
          </div>
        </div>

        {/* Batches List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold mb-4">My Batches</h2>

          {dashboardData.batches.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center">
              <p className="text-gray-500">You are not enrolled in any batches yet.</p>
            </div>
          ) : (
            dashboardData.batches.map((batch) => (
              <div
                key={batch.id}
                className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">{batch.course.name}</h3>
                    <p className="text-gray-600">{batch.course.code}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Batch: {batch.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(batch.start_date).toLocaleDateString()} -{' '}
                      {new Date(batch.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {batch.progress.progressPercentage}%
                    </div>
                    <p className="text-sm text-gray-500">
                      {batch.progress.completedLessons} / {batch.progress.totalLessons} lessons
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${batch.progress.progressPercentage}%` }}
                  ></div>
                </div>

                {/* Teachers */}
                {batch.teachers.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Teachers:</p>
                    <div className="flex flex-wrap gap-2">
                      {batch.teachers.map((teacher) => (
                        <span
                          key={teacher.id}
                          className="px-3 py-1 bg-gray-100 rounded-full text-sm"
                        >
                          {teacher.first_name} {teacher.last_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <div className="mt-4">
                  <a
                    href={`/student/batches/${batch.id}`}
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    View Course
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error loading dashboard:', error);
    redirect('/login');
  }
}

