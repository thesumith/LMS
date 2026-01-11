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

type ClassSession = {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  meeting_link: string;
  is_cancelled: boolean;
};

type ClassMaterial = {
  id: string;
  title: string;
  created_at: string;
  signed_url: string | null;
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
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [materialsByClass, setMaterialsByClass] = useState<Record<string, ClassMaterial[]>>({});
  const [materialsOpen, setMaterialsOpen] = useState<Record<string, boolean>>({});
  const [classesError, setClassesError] = useState('');
  const [creatingClass, setCreatingClass] = useState(false);
  const [uploadingForClass, setUploadingForClass] = useState<Record<string, boolean>>({});
  const [newClass, setNewClass] = useState({
    title: '',
    description: '',
    scheduledAtLocal: '',
    durationMinutes: '',
    meetingLink: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError('');

        const [batchesRes, enrollmentsRes, assignmentsRes, sessionsRes, classesRes] = await Promise.all([
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
          readJson<{ success: boolean; data: ClassSession[] }>(`/api/institute/batches/${batchId}/classes`),
        ]);

        const found = (batchesRes.data || []).find((b) => b.id === batchId) || null;

        if (!cancelled) {
          setBatch(found);
          setEnrollments(enrollmentsRes.data || []);
          setAssignments(assignmentsRes.data || []);
          setSessions(sessionsRes.data || []);
          setClasses(classesRes.data || []);
          setClassesError('');
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

  async function refreshClasses() {
    try {
      const res = await readJson<{ success: boolean; data: ClassSession[] }>(`/api/institute/batches/${batchId}/classes`);
      setClasses(res.data || []);
      setClassesError('');
    } catch (e) {
      setClassesError(e instanceof Error ? e.message : 'Failed to load classes');
    }
  }

  async function createClassSession() {
    try {
      setCreatingClass(true);
      setClassesError('');

      if (!newClass.title.trim()) throw new Error('Title is required');
      if (!newClass.scheduledAtLocal) throw new Error('Scheduled time is required');
      if (!newClass.meetingLink.trim()) throw new Error('Meeting link is required');

      const scheduledIso = new Date(newClass.scheduledAtLocal).toISOString();
      const duration =
        newClass.durationMinutes.trim() === '' ? null : Number(newClass.durationMinutes.trim());

      await readJson(`/api/institute/batches/${batchId}/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newClass.title,
          description: newClass.description || undefined,
          scheduledAt: scheduledIso,
          durationMinutes: duration,
          meetingLink: newClass.meetingLink,
        }),
      });

      setNewClass({ title: '', description: '', scheduledAtLocal: '', durationMinutes: '', meetingLink: '' });
      await refreshClasses();
    } catch (e) {
      setClassesError(e instanceof Error ? e.message : 'Failed to create class');
    } finally {
      setCreatingClass(false);
    }
  }

  async function toggleMaterials(classId: string) {
    const next = !materialsOpen[classId];
    setMaterialsOpen((prev) => ({ ...prev, [classId]: next }));
    if (!next) return;
    if (materialsByClass[classId]) return;
    try {
      const res = await readJson<{ success: boolean; data: ClassMaterial[] }>(`/api/institute/classes/${classId}/materials`);
      setMaterialsByClass((prev) => ({ ...prev, [classId]: res.data || [] }));
    } catch (e) {
      setClassesError(e instanceof Error ? e.message : 'Failed to load materials');
    }
  }

  async function uploadMaterial(classId: string, file: File, title?: string) {
    try {
      setUploadingForClass((prev) => ({ ...prev, [classId]: true }));
      setClassesError('');

      const form = new FormData();
      form.append('file', file);
      if (title?.trim()) form.append('title', title.trim());

      const res = await readJson<{ success: boolean; data: ClassMaterial }>(`/api/institute/classes/${classId}/materials`, {
        method: 'POST',
        body: form,
      });

      setMaterialsByClass((prev) => {
        const current = prev[classId] || [];
        return { ...prev, [classId]: [res.data, ...current] };
      });
      setMaterialsOpen((prev) => ({ ...prev, [classId]: true }));
    } catch (e) {
      setClassesError(e instanceof Error ? e.message : 'Failed to upload material');
    } finally {
      setUploadingForClass((prev) => ({ ...prev, [classId]: false }));
    }
  }

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
              <h2 className="text-lg font-semibold text-gray-900">Classes</h2>
              <span className="text-sm text-gray-500">{classes.length} total</span>
            </div>

            {classesError && (
              <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700">
                {classesError}
              </div>
            )}

            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <input
                  className="md:col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Class title"
                  value={newClass.title}
                  onChange={(e) => setNewClass((p) => ({ ...p, title: e.target.value }))}
                />
                <input
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  type="datetime-local"
                  value={newClass.scheduledAtLocal}
                  onChange={(e) => setNewClass((p) => ({ ...p, scheduledAtLocal: e.target.value }))}
                />
                <input
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Duration (min)"
                  inputMode="numeric"
                  value={newClass.durationMinutes}
                  onChange={(e) => setNewClass((p) => ({ ...p, durationMinutes: e.target.value }))}
                />
                <button
                  className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  onClick={createClassSession}
                  disabled={creatingClass}
                >
                  {creatingClass ? 'Creating…' : 'Schedule Class'}
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="md:col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Meeting link (Zoom/Google Meet/etc)"
                  value={newClass.meetingLink}
                  onChange={(e) => setNewClass((p) => ({ ...p, meetingLink: e.target.value }))}
                />
                <input
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Short description (optional)"
                  value={newClass.description}
                  onChange={(e) => setNewClass((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
            </div>

            {classes.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">No classes scheduled yet.</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {classes.map((c) => (
                  <div key={c.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{c.title}</p>
                          {c.is_cancelled && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Cancelled
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(c.scheduled_at).toLocaleString()}
                          {c.duration_minutes ? ` • ${c.duration_minutes} min` : ''}
                        </p>
                        {c.description && <p className="text-sm text-gray-500 mt-2 whitespace-pre-wrap">{c.description}</p>}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <a
                          href={c.meeting_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-blue-600 hover:text-blue-900"
                        >
                          Join Link
                        </a>
                        <button
                          className="text-sm font-medium text-gray-700 hover:text-gray-900"
                          onClick={() => toggleMaterials(c.id)}
                        >
                          {materialsOpen[c.id] ? 'Hide Materials' : 'Materials'}
                        </button>
                      </div>
                    </div>

                    {materialsOpen[c.id] && (
                      <div className="mt-4 bg-gray-50 border border-gray-200 rounded-md p-4 space-y-3">
                        <MaterialUploader
                          disabled={!!uploadingForClass[c.id]}
                          onUpload={(file, title) => uploadMaterial(c.id, file, title)}
                        />

                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Files</p>
                          {(materialsByClass[c.id] || []).length === 0 ? (
                            <p className="text-sm text-gray-500">No materials uploaded yet.</p>
                          ) : (
                            <ul className="space-y-2">
                              {(materialsByClass[c.id] || []).map((m) => (
                                <li key={m.id} className="flex items-center justify-between gap-4">
                                  <div className="min-w-0">
                                    <p className="text-sm text-gray-900 truncate">{m.title}</p>
                                    <p className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString()}</p>
                                  </div>
                                  <a
                                    href={m.signed_url || '#'}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`text-sm font-medium ${
                                      m.signed_url ? 'text-blue-600 hover:text-blue-900' : 'text-gray-400'
                                    }`}
                                  >
                                    Download
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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

function MaterialUploader({
  disabled,
  onUpload,
}: {
  disabled: boolean;
  onUpload: (file: File, title?: string) => void | Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');

  return (
    <div className="flex flex-col md:flex-row md:items-end gap-3">
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Upload material
        </label>
        <input
          type="file"
          className="block w-full text-sm text-gray-700"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          disabled={disabled}
        />
      </div>
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Title (optional)
        </label>
        <input
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="e.g., Slides, Notes, Recording link"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
        />
      </div>
      <button
        className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-black disabled:opacity-50"
        disabled={disabled || !file}
        onClick={async () => {
          if (!file) return;
          await onUpload(file, title || undefined);
          setFile(null);
          setTitle('');
        }}
      >
        {disabled ? 'Uploading…' : 'Upload'}
      </button>
    </div>
  );
}


