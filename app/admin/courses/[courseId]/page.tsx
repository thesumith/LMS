/**
 * Admin Course Detail Page
 *
 * Shows course info + modules + related batches.
 * Fixes missing dynamic route used by `/admin/courses` "View" action.
 */
 
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Course = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

type Module = {
  id: string;
  name: string;
  description: string | null;
  sequence: number;
  is_active: boolean;
  created_at: string;
};

type Batch = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  courses?: { name: string; code: string } | null;
};

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Request failed: ${res.status}`);
  }
  return json as T;
}

export default function AdminCourseDetailPage({
  params,
}: {
  params: { courseId: string };
}) {
  const courseId = params.courseId;

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError('');

        const [coursesRes, modulesRes, batchesRes] = await Promise.all([
          readJson<{ success: boolean; data: Course[] }>(`/api/institute/courses`),
          readJson<{ success: boolean; data: Module[] }>(
            `/api/institute/courses/${courseId}/modules`
          ),
          readJson<{ success: boolean; data: Batch[] }>(
            `/api/institute/batches?courseId=${encodeURIComponent(courseId)}`
          ),
        ]);

        const found = (coursesRes.data || []).find((c) => c.id === courseId) || null;

        if (!cancelled) {
          setCourse(found);
          setModules(modulesRes.data || []);
          setBatches(batchesRes.data || []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load course');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const stats = useMemo(() => {
    const activeModules = modules.filter((m) => m.is_active).length;
    const activeBatches = batches.filter((b) => b.is_active).length;
    return {
      moduleCount: modules.length,
      activeModules,
      batchCount: batches.length,
      activeBatches,
    };
  }, [modules, batches]);

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
          <div className="flex items-center gap-3">
            <Link
              href="/admin/courses"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-600">Course</span>
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 mt-2">
            {course ? `${course.code} — ${course.name}` : 'Course'}
          </h1>
          <p className="text-gray-600">
            {course?.description || 'Course details and curriculum structure'}
          </p>
        </div>
        {course && (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              course.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}
          >
            {course.is_active ? 'Active' : 'Inactive'}
          </span>
        )}
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

      {!course && !error && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <p className="text-gray-700">Course not found.</p>
          <div className="mt-3">
            <Link href="/admin/courses" className="text-blue-600 hover:text-blue-900 text-sm">
              Return to courses
            </Link>
          </div>
        </div>
      )}

      {course && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="Modules" value={stats.moduleCount} color="blue" />
            <StatCard title="Active Modules" value={stats.activeModules} color="green" />
            <StatCard title="Batches" value={stats.batchCount} color="purple" />
            <StatCard title="Active Batches" value={stats.activeBatches} color="orange" />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Modules</h2>
              <span className="text-sm text-gray-500">{modules.length} total</span>
            </div>
            {modules.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">
                No modules yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sequence
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Module
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {modules.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {m.sequence}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{m.name}</div>
                          {m.description && (
                            <div className="text-sm text-gray-500 mt-1 line-clamp-2">{m.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              m.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {m.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Batches</h2>
              <span className="text-sm text-gray-500">{batches.length} total</span>
            </div>
            {batches.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">
                No batches for this course yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Batch
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {batches.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{b.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(b.start_date).toLocaleDateString()} — {new Date(b.end_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              b.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {b.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/admin/batches/${b.id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-semibold text-gray-900">{value.toLocaleString()}</p>
        </div>
        <div className={`flex-shrink-0 p-3 rounded-lg ${colorClasses[color]}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
      </div>
    </div>
  );
}


