/**
 * Admin Batch Detail Page
 *
 * Manages batch details, teacher assignments, and student enrollments.
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
  courses?: { id?: string; name: string; code: string } | null;
};

type TeacherAssignment = {
  id: string;
  teacher_id: string;
  profiles?: { id: string; email: string; first_name: string | null; last_name: string | null } | null;
};

type User = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  roles: string[];
  is_active: boolean;
};

type Enrollment = {
  id: string;
  student_id: string;
  status: 'active' | 'completed' | 'dropped';
  enrolled_at?: string;
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

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Request failed: ${res.status}`);
  }
  return json as T;
}

function displayName(p?: { email: string; first_name: string | null; last_name: string | null } | null) {
  if (!p) return 'Unknown';
  const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
  return name || p.email;
}

export default function AdminBatchDetailPage({
  params,
}: {
  params: { batchId: string };
}) {
  const batchId = params.batchId;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [teachers, setTeachers] = useState<TeacherAssignment[]>([]);
  const [allTeachers, setAllTeachers] = useState<User[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [savingTeachers, setSavingTeachers] = useState(false);

  // Student enrollment state
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [savingStudents, setSavingStudents] = useState(false);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Get enrolled student IDs to filter them out from the dropdown
  const enrolledStudentIds = useMemo(() => {
    return new Set(enrollments.map((e) => e.student_id));
  }, [enrollments]);

  // Filter students who are not already enrolled
  const availableStudents = useMemo(() => {
    return allStudents.filter((s) => !enrolledStudentIds.has(s.id));
  }, [allStudents, enrolledStudentIds]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError('');

        const [batchesRes, teachersRes, enrollmentsRes, assignmentsRes, usersRes] = await Promise.all([
          readJson<{ success: boolean; data: Batch[] }>(`/api/institute/batches`),
          readJson<{ success: boolean; data: TeacherAssignment[] }>(
            `/api/institute/batches/${batchId}/teachers`
          ),
          readJson<{ success: boolean; data: Enrollment[] }>(
            `/api/institute/enrollments?batchId=${encodeURIComponent(batchId)}`
          ),
          readJson<{ success: boolean; data: Assignment[] }>(
            `/api/institute/batches/${batchId}/assignments?active=true`
          ),
          readJson<{ success: boolean; data: User[] }>(`/api/institute/users`),
        ]);

        const found = (batchesRes.data || []).find((b) => b.id === batchId) || null;

        if (!cancelled) {
          setBatch(found);
          setTeachers(teachersRes.data || []);
          const all = usersRes.data || [];
          setAllTeachers(all.filter((u) => (u.roles || []).includes('TEACHER')).filter((u) => u.is_active !== false));
          setAllStudents(all.filter((u) => (u.roles || []).includes('STUDENT')).filter((u) => u.is_active !== false));
          setEnrollments(enrollmentsRes.data || []);
          setAssignments(assignmentsRes.data || []);
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

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  async function refreshTeacherAssignments() {
    const teachersRes = await readJson<{ success: boolean; data: TeacherAssignment[] }>(
      `/api/institute/batches/${batchId}/teachers`
    );
    setTeachers(teachersRes.data || []);
  }

  async function refreshEnrollments() {
    const enrollmentsRes = await readJson<{ success: boolean; data: Enrollment[] }>(
      `/api/institute/enrollments?batchId=${encodeURIComponent(batchId)}`
    );
    setEnrollments(enrollmentsRes.data || []);
  }

  async function assignSelectedTeachers() {
    if (selectedTeacherIds.length === 0) return;
    try {
      setSavingTeachers(true);
      setError('');
      await readJson(`/api/institute/batches/${batchId}/teachers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherIds: selectedTeacherIds }),
      });
      setSelectedTeacherIds([]);
      await refreshTeacherAssignments();
      setSuccessMessage('Teachers assigned successfully!');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign teachers');
    } finally {
      setSavingTeachers(false);
    }
  }

  async function removeTeacher(teacherId: string) {
    try {
      setSavingTeachers(true);
      setError('');
      await readJson(
        `/api/institute/batches/${batchId}/teachers?teacherIds=${encodeURIComponent(teacherId)}`,
        { method: 'DELETE' }
      );
      await refreshTeacherAssignments();
      setSuccessMessage('Teacher removed successfully!');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove teacher');
    } finally {
      setSavingTeachers(false);
    }
  }

  async function enrollSelectedStudents() {
    if (selectedStudentIds.length === 0) return;
    try {
      setSavingStudents(true);
      setError('');

      // Enroll each student one by one
      let successCount = 0;
      const errors: string[] = [];

      for (const studentId of selectedStudentIds) {
        try {
          await readJson(`/api/institute/enrollments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batchId, studentId }),
          });
          successCount++;
        } catch (e) {
          const student = allStudents.find((s) => s.id === studentId);
          errors.push(`${displayName(student)}: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }

      setSelectedStudentIds([]);
      await refreshEnrollments();

      if (successCount > 0) {
        setSuccessMessage(`${successCount} student(s) enrolled successfully!`);
      }
      if (errors.length > 0) {
        setError(`Some enrollments failed: ${errors.join(', ')}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to enroll students');
    } finally {
      setSavingStudents(false);
    }
  }

  async function updateEnrollmentStatus(enrollmentId: string, status: 'active' | 'completed' | 'dropped') {
    try {
      setSavingStudents(true);
      setError('');
      await readJson(`/api/institute/enrollments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId, status }),
      });
      await refreshEnrollments();
      setSuccessMessage(`Enrollment status updated to ${status}!`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update enrollment');
    } finally {
      setSavingStudents(false);
    }
  }

  const stats = useMemo(() => {
    const activeStudents = enrollments.filter((e) => e.status === 'active').length;
    const activeAssignments = assignments.filter((a) => a.is_active).length;
    return {
      teacherCount: teachers.length,
      studentCount: activeStudents,
      totalEnrollments: enrollments.length,
      assignmentCount: assignments.length,
      activeAssignments,
    };
  }, [teachers, enrollments, assignments]);

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
            <Link href="/admin/batches" className="text-sm text-gray-600 hover:text-gray-900">
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
        <div className="flex items-center gap-3">
          <Link
            href="/admin/enrollments"
            className="rounded-md bg-purple-600 text-white px-4 py-2 text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            Bulk Enrollment
          </Link>
          {batch && (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${batch.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}
            >
              {batch.is_active ? 'Active' : 'Inactive'}
            </span>
          )}
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
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
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {!batch && !error && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <p className="text-gray-700">Batch not found.</p>
          <div className="mt-3">
            <Link href="/admin/batches" className="text-blue-600 hover:text-blue-900 text-sm">
              Return to batches
            </Link>
          </div>
        </div>
      )}

      {batch && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="Teachers" value={stats.teacherCount} color="orange" icon="users" />
            <StatCard title="Active Students" value={stats.studentCount} color="purple" icon="student" />
            <StatCard title="Assignments" value={stats.assignmentCount} color="blue" icon="assignment" />
            <StatCard title="Active Assignments" value={stats.activeAssignments} color="green" icon="check" />
          </div>

          {/* Teachers Section */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Teachers</h2>
              <span className="text-sm text-gray-500">{teachers.length} assigned</span>
            </div>
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Assign teachers
                  </label>
                  <select
                    multiple
                    value={selectedTeacherIds}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                      setSelectedTeacherIds(selected);
                    }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={savingTeachers}
                  >
                    {allTeachers.length === 0 ? (
                      <option value="" disabled>
                        No teachers found
                      </option>
                    ) : (
                      allTeachers.map((t) => {
                        const name = `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.email;
                        return (
                          <option key={t.id} value={t.id}>
                            {name} ({t.email})
                          </option>
                        );
                      })
                    )}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Teachers only see batches they're assigned to. Hold Ctrl/Cmd to select multiple.
                  </p>
                </div>
                <button
                  className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  onClick={assignSelectedTeachers}
                  disabled={savingTeachers || selectedTeacherIds.length === 0}
                >
                  {savingTeachers ? 'Saving…' : 'Assign'}
                </button>
              </div>
            </div>
            {teachers.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">
                No teachers assigned to this batch.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Teacher
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {teachers.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900">{displayName(t.profiles)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{t.profiles?.email || '—'}</td>
                        <td className="px-6 py-4 text-right text-sm font-medium">
                          <button
                            className="text-red-600 hover:text-red-800 disabled:opacity-50"
                            onClick={() => removeTeacher(t.teacher_id)}
                            disabled={savingTeachers}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Students Section with Enrollment UI */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Students</h2>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">{stats.studentCount} active / {stats.totalEnrollments} total</span>
              </div>
            </div>

            {/* Enrollment Form */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Enroll Students
                  </label>
                  <select
                    multiple
                    value={selectedStudentIds}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                      setSelectedStudentIds(selected);
                    }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    disabled={savingStudents}
                    size={5}
                  >
                    {availableStudents.length === 0 ? (
                      <option value="" disabled>
                        {allStudents.length === 0 ? 'No students found in institute' : 'All students are already enrolled'}
                      </option>
                    ) : (
                      availableStudents.map((s) => {
                        const name = `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email;
                        return (
                          <option key={s.id} value={s.id}>
                            {name} ({s.email})
                          </option>
                        );
                      })
                    )}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select students to enroll in this batch. Hold Ctrl/Cmd to select multiple.
                  </p>
                </div>
                <button
                  className="rounded-md bg-purple-600 text-white px-4 py-2 text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  onClick={enrollSelectedStudents}
                  disabled={savingStudents || selectedStudentIds.length === 0}
                >
                  {savingStudents ? 'Enrolling…' : `Enroll ${selectedStudentIds.length > 0 ? `(${selectedStudentIds.length})` : ''}`}
                </button>
              </div>
            </div>

            {enrollments.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <p>No students enrolled in this batch yet.</p>
                <p className="text-xs text-gray-400 mt-1">Use the form above to enroll students.</p>
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
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {enrollments.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900">{displayName(e.profiles)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{e.profiles?.email || '—'}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${e.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : e.status === 'completed'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                          >
                            {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            {e.status !== 'active' && (
                              <button
                                className="text-green-600 hover:text-green-800 disabled:opacity-50"
                                onClick={() => updateEnrollmentStatus(e.id, 'active')}
                                disabled={savingStudents}
                                title="Reactivate"
                              >
                                Activate
                              </button>
                            )}
                            {e.status === 'active' && (
                              <>
                                <button
                                  className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                  onClick={() => updateEnrollmentStatus(e.id, 'completed')}
                                  disabled={savingStudents}
                                  title="Mark as completed"
                                >
                                  Complete
                                </button>
                                <button
                                  className="text-red-600 hover:text-red-800 disabled:opacity-50"
                                  onClick={() => updateEnrollmentStatus(e.id, 'dropped')}
                                  disabled={savingStudents}
                                  title="Drop student"
                                >
                                  Drop
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Assignments Section */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Assignments</h2>
              <span className="text-sm text-gray-500">{assignments.length} total</span>
            </div>
            {assignments.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">
                No assignments for this batch.
              </div>
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${a.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}
                          >
                            {a.is_active ? 'Active' : 'Inactive'}
                          </span>
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
  icon,
}: {
  title: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'orange';
  icon: 'users' | 'student' | 'assignment' | 'check';
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  const icons = {
    users: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    ),
    student: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    ),
    assignment: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    ),
    check: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
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
            {icons[icon]}
          </svg>
        </div>
      </div>
    </div>
  );
}


