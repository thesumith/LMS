/**
 * Teacher Students Page
 *
 * Mentioned in docs; powered by `/api/teacher/dashboard` (batches list)
 * and `/api/teacher/batches/[batchId]/students` (students list).
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

type Batch = {
  id: string;
  name: string;
  courses: { code: string; name: string };
};

type DashboardResponse = {
  success: boolean;
  data: { batches: Batch[] };
};

type StudentsResponse = {
  success: boolean;
  data: {
    batch: {
      id: string;
      name: string;
      start_date: string;
      end_date: string;
      courses: { name: string; code: string };
    };
    students: Array<{
      id: string;
      student_id: string;
      status: 'active' | 'completed' | 'dropped';
      enrolled_at: string;
      profiles: { id: string; email: string; first_name: string | null; last_name: string | null } | null;
    }>;
    statistics: { total: number; active: number; completed: number; dropped: number };
  };
};

async function readJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed: ${res.status}`);
  return json as T;
}

function displayName(p?: { email: string; first_name: string | null; last_name: string | null } | null) {
  if (!p) return 'Unknown';
  const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
  return name || p.email;
}

export default function TeacherStudentsPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [status, setStatus] = useState<'active' | 'completed' | 'dropped' | ''>('active');
  const [data, setData] = useState<StudentsResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadBatches() {
      try {
        setLoading(true);
        setError('');
        const res = await readJson<DashboardResponse>('/api/teacher/dashboard');
        const list = res.data?.batches || [];
        if (!cancelled) {
          setBatches(list);
          setSelectedBatchId(list[0]?.id || '');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load batches');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadBatches();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadStudents() {
      if (!selectedBatchId) {
        setData(null);
        return;
      }

      try {
        setLoadingStudents(true);
        setError('');
        const qs = status ? `?status=${encodeURIComponent(status)}` : '';
        const res = await readJson<StudentsResponse>(`/api/teacher/batches/${selectedBatchId}/students${qs}`);
        if (!cancelled) setData(res.data || null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load students');
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    }
    loadStudents();
    return () => {
      cancelled = true;
    };
  }, [selectedBatchId, status]);

  const rows = useMemo(() => data?.students || [], [data]);

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
      <div className="mb-2">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Students</h1>
        <p className="text-gray-600">View students in your assigned batches</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Batch</label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.courses?.code} — {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
              <option value="">All</option>
            </select>
          </div>
        </div>
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
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Students</h2>
          <span className="text-sm text-gray-500">
            {loadingStudents ? 'Loading…' : `${rows.length} shown`}
          </span>
        </div>
        {loadingStudents ? (
          <div className="px-6 py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">No students found.</div>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {displayName(s.profiles)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{s.profiles?.email || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {s.status}
                      </span>
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


