/**
 * Teacher Courses Page
 *
 * Mentioned in docs; powered by `/api/teacher/dashboard` (batches + course info).
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Batch = {
  id: string;
  name: string;
  is_active: boolean;
  courses: {
    id: string;
    name: string;
    code: string;
    description: string | null;
  };
};

type DashboardResponse = {
  success: boolean;
  data: {
    batches: Batch[];
    summary?: {
      totalBatches: number;
      activeBatches: number;
      totalStudents: number;
      activeStudents: number;
    };
  };
};

async function readJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed: ${res.status}`);
  return json as T;
}

export default function TeacherCoursesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await readJson<DashboardResponse>('/api/teacher/dashboard');
        if (!cancelled) setBatches(res.data?.batches || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load courses');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const courses = useMemo(() => {
    const map = new Map<string, { course: Batch['courses']; totalBatches: number; activeBatches: number }>();
    for (const b of batches) {
      if (!b.courses?.id) continue;
      const existing = map.get(b.courses.id) || { course: b.courses, totalBatches: 0, activeBatches: 0 };
      existing.totalBatches += 1;
      if (b.is_active) existing.activeBatches += 1;
      map.set(b.courses.id, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.course.code.localeCompare(b.course.code));
  }, [batches]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">My Courses</h1>
          <p className="text-gray-600">Courses you’re teaching (derived from your assigned batches)</p>
        </div>
        <Link
          href="/teacher/batches"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          View batches
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Courses</h2>
        </div>
        {courses.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            No courses found. You may not be assigned to any batches yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Batches
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {courses.map(({ course, totalBatches, activeBatches }) => (
                  <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {course.code}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{course.name}</div>
                      {course.description && (
                        <div className="text-sm text-gray-500 mt-1 line-clamp-2">{course.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {activeBatches} active / {totalBatches} total
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


