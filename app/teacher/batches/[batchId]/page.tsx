/**
 * Teacher Batch Detail Page
 *
 * Fixes missing dynamic route used by `/teacher/batches` "View" action.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Batch = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  courses?: { name: string; code: string } | null;
};

type Enrollment = {
  id: string;
  student_id: string;
  status: 'active' | 'completed' | 'dropped';
  profiles?: { id: string; email: string; first_name: string | null; last_name: string | null } | null;
};

type Assignment = {
  id: string;
  title: string;
  due_date: string;
  submission_deadline: string | null;
  max_marks: number | null;
  is_active: boolean;
};

type AttendanceSession = {
  id: string;
  session_date: string;
  session_type: 'manual' | 'automatic';
  title: string | null;
  is_locked: boolean;
};

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed: ${res.status}`);
  return json as T;
}

function displayName(p?: { email: string; first_name: string | null; last_name: string | null } | null) {
  if (!p) return 'Unknown';
  const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
  return name || p.email;
}

export default function TeacherBatchDetailPage({
  params,
}: {
  params: { batchId: string };
}) {
  const batchId = params.batchId;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError('');

        const [batchesRes, enrollmentsRes, assignmentsRes, sessionsRes] = await Promise.all([
          readJson<{ success: boolean; data: Batch[] }>(`/api/institute/batches`),
          readJson<{ success: boolean; data: Enrollment[] }>(
            `/api/institute/enrollments?batchId=${encodeURIComponent(batchId)}&status=active`
          ),
          readJson<{ success: boolean; data: Assignment[] }>(
            `/api/institute/batches/${batchId}/assignments?active=true`
          ),
          readJson<{ success: boolean; data: AttendanceSession[] }>(
            `/api/institute/batches/${batchId}/attendance/sessions`
          ),
        ]);

        const found = (batchesRes.data || []).find((b) => b.id === batchId) || null;

        if (!cancelled) {
          setBatch(found);
          setEnrollments(enrollmentsRes.data || []);
          setAssignments(assignmentsRes.data || []);
          setSessions(sessionsRes.data || []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load batch');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const stats = useMemo(() => {
    const upcomingSessions = sessions.filter((s) => {
      const d = new Date(s.session_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return d >= today;
    }).length;
    return {
      studentCount: enrollments.length,
      assignmentCount: assignments.length,
      sessionCount: sessions.length,
      upcomingSessions,
    };
  }, [enrollments, assignments, sessions]);

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
            <Link href="/teacher/batches" className="text-sm text-gray-600 hover:text-gray-900">
              ← Back
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-600">Batch</span>
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 mt-2">
            {batch ? batch.name : 'Batch'}
          </h1>
          <p className="text-gray-600">
            {batch?.courses ? `${batch.courses.code} — ${batch.courses.name}` : 'Batch details'}
          </p>
        </div>
        {batch && (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              batch.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}
          >
            {batch.is_active ? 'Active' : 'Inactive'}
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

      {!batch && !error && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <p className="text-gray-700">Batch not found.</p>
        </div>
      )}

      {batch && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="Active Students" value={stats.studentCount} color="purple" />
            <StatCard title="Assignments" value={stats.assignmentCount} color="blue" />
            <StatCard title="Sessions" value={stats.sessionCount} color="green" />
            <StatCard title="Upcoming" value={stats.upcomingSessions} color="orange" />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Students</h2>
              <span className="text-sm text-gray-500">{enrollments.length} active</span>
            </div>
            {enrollments.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">No active students.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {enrollments.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900">{displayName(e.profiles)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{e.profiles?.email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Assignments</h2>
              <span className="text-sm text-gray-500">{assignments.length} total</span>
            </div>
            {assignments.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">No assignments.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {assignments.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{a.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(a.due_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/teacher/assignments/${a.id}`}
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

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Attendance Sessions</h2>
              <span className="text-sm text-gray-500">{sessions.length} total</span>
            </div>
            {sessions.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">No sessions.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Session
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
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
                    {sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {s.title || 'Attendance Session'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(s.session_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              s.is_locked ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {s.is_locked ? 'Locked' : 'Open'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/teacher/attendance/${s.id}`}
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}


