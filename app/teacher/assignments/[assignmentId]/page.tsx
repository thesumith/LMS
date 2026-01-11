/**
 * Teacher Assignment Detail Page
 *
 * Fixes missing dynamic route used by `/teacher/assignments` "View" action.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Assignment = {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  submission_deadline: string | null;
  max_marks: number | null;
  is_active: boolean;
  batches?: { id: string; name: string } | null;
  courses?: { id: string; name: string; code: string } | null;
};

type Submission = {
  id: string;
  submitted_at: string;
  marks: number | null;
  evaluated_at: string | null;
  is_late: boolean;
  file_name: string | null;
  file_size: number | null;
  profiles?: { id: string; email: string; first_name: string | null; last_name: string | null } | null;
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

export default function TeacherAssignmentDetailPage({
  params,
}: {
  params: { assignmentId: string };
}) {
  const assignmentId = params.assignmentId;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError('');

        const [assignmentRes, submissionsRes] = await Promise.all([
          readJson<{ success: boolean; data: Assignment }>(`/api/institute/assignments/${assignmentId}`),
          readJson<{ success: boolean; data: Submission[] }>(
            `/api/institute/assignments/${assignmentId}/submissions`
          ),
        ]);

        if (!cancelled) {
          setAssignment(assignmentRes.data || null);
          setSubmissions(submissionsRes.data || []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load assignment');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  const stats = useMemo(() => {
    const submitted = submissions.length;
    const evaluated = submissions.filter((s) => s.evaluated_at).length;
    const late = submissions.filter((s) => s.is_late).length;
    return { submitted, evaluated, late };
  }, [submissions]);

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
            <Link href="/teacher/assignments" className="text-sm text-gray-600 hover:text-gray-900">
              ← Back
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-600">Assignment</span>
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 mt-2">
            {assignment?.title || 'Assignment'}
          </h1>
          <p className="text-gray-600">
            {assignment?.courses ? `${assignment.courses.code} — ${assignment.courses.name}` : 'Assignment details'}
          </p>
        </div>
        {assignment && (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              assignment.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}
          >
            {assignment.is_active ? 'Active' : 'Inactive'}
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

      {assignment && (
        <>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Info title="Due Date" value={new Date(assignment.due_date).toLocaleDateString()} />
              <Info
                title="Submission Deadline"
                value={
                  assignment.submission_deadline
                    ? new Date(assignment.submission_deadline).toLocaleDateString()
                    : '—'
                }
              />
              <Info title="Max Marks" value={assignment.max_marks !== null ? String(assignment.max_marks) : '—'} />
            </div>
            {assignment.description && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{assignment.description}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Submissions" value={stats.submitted} color="blue" />
            <StatCard title="Evaluated" value={stats.evaluated} color="green" />
            <StatCard title="Late" value={stats.late} color="orange" />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Submissions</h2>
              <span className="text-sm text-gray-500">{submissions.length} total</span>
            </div>
            {submissions.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">
                No submissions yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Submitted
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
                    {submissions.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{displayName(s.profiles)}</div>
                          <div className="text-sm text-gray-500">{s.profiles?.email || '—'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(s.submitted_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {s.is_late ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Late
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              On time
                            </span>
                          )}
                          {s.evaluated_at ? (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Evaluated
                            </span>
                          ) : (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {s.marks !== null && s.marks !== undefined ? s.marks : '—'}
                          {assignment.max_marks !== null && assignment.max_marks !== undefined
                            ? ` / ${assignment.max_marks}`
                            : ''}
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

function Info({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
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
  color: 'blue' | 'green' | 'orange';
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}


