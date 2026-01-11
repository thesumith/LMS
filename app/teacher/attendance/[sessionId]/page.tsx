/**
 * Teacher Attendance Session Detail Page
 *
 * Fixes missing dynamic route used by `/teacher/attendance` "View" action.
 * Uses `/api/institute/attendance/sessions/[sessionId]/records` which now returns
 * both records and metadata (session + enrolled students).
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type SessionMeta = {
  id: string;
  batch_id: string;
  session_date: string;
  session_type: 'manual' | 'automatic';
  title: string | null;
  description: string | null;
  is_locked: boolean;
  batches?: { id: string; name: string } | null;
  courses?: { id: string; name: string; code: string } | null;
  lessons?: { id: string; title: string } | null;
};

type StudentRow = {
  student_id: string;
  profiles?: { id: string; email: string; first_name: string | null; last_name: string | null } | null;
};

type AttendanceRecord = {
  id: string;
  student_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes: string | null;
};

type RecordsResponse = {
  success: boolean;
  data: AttendanceRecord[];
  meta?: {
    session: SessionMeta;
    students: StudentRow[];
  };
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

export default function TeacherAttendanceSessionDetailPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const sessionId = params.sessionId;

  const [session, setSession] = useState<SessionMeta | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [draft, setDraft] = useState<Record<string, AttendanceRecord['status']>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const res = await readJson<RecordsResponse>(`/api/institute/attendance/sessions/${sessionId}/records`);
    setSession(res.meta?.session || null);
    setStudents(res.meta?.students || []);
    setRecords(res.data || []);
  };

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError('');
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load session');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const recordByStudentId = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of records) map.set(r.student_id, r);
    return map;
  }, [records]);

  const derivedStatus = (studentId: string): AttendanceRecord['status'] => {
    return draft[studentId] || recordByStudentId.get(studentId)?.status || 'absent';
  };

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    for (const s of students) {
      const st = derivedStatus(s.student_id);
      if (st === 'present') present += 1;
      else if (st === 'late') late += 1;
      else if (st === 'excused') excused += 1;
      else absent += 1;
    }
    return { total: students.length, present, absent, late, excused };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, records, draft]);

  const saveAll = async () => {
    if (!session) return;
    if (session.is_locked) {
      setError('Session is locked');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const payload = {
        records: students.map((s) => ({
          studentId: s.student_id,
          status: derivedStatus(s.student_id),
        })),
      };

      await readJson(`/api/institute/attendance/sessions/${sessionId}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setDraft({});
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const lockSession = async () => {
    try {
      setLocking(true);
      setError('');
      await readJson(`/api/institute/attendance/sessions/${sessionId}/lock`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to lock session');
    } finally {
      setLocking(false);
    }
  };

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
            <Link href="/teacher/attendance" className="text-sm text-gray-600 hover:text-gray-900">
              ← Back
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-600">Session</span>
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 mt-2">
            {session?.title || 'Attendance Session'}
          </h1>
          <p className="text-gray-600">
            {session?.courses ? `${session.courses.code} — ${session.courses.name}` : 'Attendance'}
            {session?.batches ? ` · ${session.batches.name}` : ''}
            {session?.session_date ? ` · ${new Date(session.session_date).toLocaleDateString()}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {session?.is_locked ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              Locked
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Open
            </span>
          )}
          <button
            onClick={saveAll}
            disabled={saving || !!session?.is_locked}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={lockSession}
            disabled={locking || !!session?.is_locked}
            className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {locking ? 'Locking...' : 'Lock'}
          </button>
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

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Stat title="Total" value={stats.total} color="blue" />
        <Stat title="Present" value={stats.present} color="green" />
        <Stat title="Late" value={stats.late} color="orange" />
        <Stat title="Excused" value={stats.excused} color="purple" />
        <Stat title="Absent" value={stats.absent} color="gray" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Students</h2>
          <span className="text-sm text-gray-500">{students.length} enrolled</span>
        </div>
        {students.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">No students enrolled.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((s) => {
                  const status = derivedStatus(s.student_id);
                  return (
                    <tr key={s.student_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{displayName(s.profiles)}</div>
                        <div className="text-sm text-gray-500">{s.profiles?.email || '—'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          disabled={!!session?.is_locked}
                          value={status}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [s.student_id]: e.target.value as AttendanceRecord['status'],
                            }))
                          }
                          className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60"
                        >
                          <option value="present">Present</option>
                          <option value="late">Late</option>
                          <option value="excused">Excused</option>
                          <option value="absent">Absent</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'gray';
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-50 text-gray-600',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-semibold text-gray-900">{value.toLocaleString()}</p>
        </div>
        <div className={`flex-shrink-0 p-3 rounded-lg ${colorClasses[color]}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
    </div>
  );
}


