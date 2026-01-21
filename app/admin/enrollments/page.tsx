/**
 * Admin Bulk Enrollment Page
 *
 * Allows Institute Admin to enroll multiple students into multiple batches at once.
 * Provides a comprehensive view of all enrollments with filtering and bulk actions.
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
    batch_id: string;
    student_id: string;
    status: 'active' | 'completed' | 'dropped';
    enrolled_at: string;
    batches?: {
        id: string;
        name: string;
        courses?: { name: string; code: string } | null;
    } | null;
    profiles?: {
        id: string;
        email: string;
        first_name: string | null;
        last_name: string | null;
    } | null;
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

export default function AdminBulkEnrollmentPage() {
    // Data state
    const [batches, setBatches] = useState<Batch[]>([]);
    const [students, setStudents] = useState<User[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

    // Selection state for bulk enrollment
    const [selectedBatchId, setSelectedBatchId] = useState<string>('');
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

    // Filter state
    const [filterBatchId, setFilterBatchId] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    // UI state
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Tab state
    const [activeTab, setActiveTab] = useState<'enroll' | 'manage'>('enroll');

    // Get enrolled student IDs for the selected batch
    const enrolledStudentIdsForBatch = useMemo(() => {
        if (!selectedBatchId) return new Set<string>();
        return new Set(
            enrollments
                .filter((e) => e.batch_id === selectedBatchId && e.status === 'active')
                .map((e) => e.student_id)
        );
    }, [enrollments, selectedBatchId]);

    // Filter available students (not enrolled in selected batch)
    const availableStudents = useMemo(() => {
        return students.filter((s) => !enrolledStudentIdsForBatch.has(s.id));
    }, [students, enrolledStudentIdsForBatch]);

    // Filter enrollments for display
    const filteredEnrollments = useMemo(() => {
        let filtered = [...enrollments];

        if (filterBatchId) {
            filtered = filtered.filter((e) => e.batch_id === filterBatchId);
        }

        if (filterStatus) {
            filtered = filtered.filter((e) => e.status === filterStatus);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter((e) => {
                const studentName = displayName(e.profiles).toLowerCase();
                const batchName = e.batches?.name?.toLowerCase() || '';
                const courseName = e.batches?.courses?.name?.toLowerCase() || '';
                return (
                    studentName.includes(query) ||
                    batchName.includes(query) ||
                    courseName.includes(query)
                );
            });
        }

        return filtered;
    }, [enrollments, filterBatchId, filterStatus, searchQuery]);

    // Stats
    const stats = useMemo(() => {
        const activeCount = enrollments.filter((e) => e.status === 'active').length;
        const completedCount = enrollments.filter((e) => e.status === 'completed').length;
        const droppedCount = enrollments.filter((e) => e.status === 'dropped').length;
        return {
            total: enrollments.length,
            active: activeCount,
            completed: completedCount,
            dropped: droppedCount,
        };
    }, [enrollments]);

    useEffect(() => {
        loadData();
    }, []);

    // Clear success message after 5 seconds
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(''), 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    async function loadData() {
        try {
            setLoading(true);
            setError('');

            const [batchesRes, usersRes, enrollmentsRes] = await Promise.all([
                readJson<{ success: boolean; data: Batch[] }>('/api/institute/batches'),
                readJson<{ success: boolean; data: User[] }>('/api/institute/users'),
                readJson<{ success: boolean; data: Enrollment[] }>('/api/institute/enrollments'),
            ]);

            setBatches(batchesRes.data?.filter((b) => b.is_active) || []);
            setStudents(
                usersRes.data?.filter((u) => u.roles?.includes('STUDENT') && u.is_active !== false) || []
            );
            setEnrollments(enrollmentsRes.data || []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }

    async function handleBulkEnroll() {
        if (!selectedBatchId || selectedStudentIds.length === 0) return;

        try {
            setSaving(true);
            setError('');

            let successCount = 0;
            const errors: string[] = [];

            for (const studentId of selectedStudentIds) {
                try {
                    await readJson('/api/institute/enrollments', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ batchId: selectedBatchId, studentId }),
                    });
                    successCount++;
                } catch (e) {
                    const student = students.find((s) => s.id === studentId);
                    errors.push(`${displayName(student)}`);
                }
            }

            // Refresh enrollments
            const enrollmentsRes = await readJson<{ success: boolean; data: Enrollment[] }>(
                '/api/institute/enrollments'
            );
            setEnrollments(enrollmentsRes.data || []);

            // Clear selection
            setSelectedStudentIds([]);

            if (successCount > 0) {
                const batch = batches.find((b) => b.id === selectedBatchId);
                setSuccessMessage(
                    `Successfully enrolled ${successCount} student(s) in "${batch?.name || 'batch'}"!`
                );
            }
            if (errors.length > 0) {
                setError(`Failed to enroll: ${errors.join(', ')}`);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to enroll students');
        } finally {
            setSaving(false);
        }
    }

    async function updateEnrollmentStatus(
        enrollmentId: string,
        status: 'active' | 'completed' | 'dropped'
    ) {
        try {
            setSaving(true);
            setError('');
            await readJson('/api/institute/enrollments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enrollmentId, status }),
            });

            // Refresh enrollments
            const enrollmentsRes = await readJson<{ success: boolean; data: Enrollment[] }>(
                '/api/institute/enrollments'
            );
            setEnrollments(enrollmentsRes.data || []);
            setSuccessMessage(`Enrollment status updated to ${status}!`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to update enrollment');
        } finally {
            setSaving(false);
        }
    }

    function handleSelectAllStudents() {
        if (selectedStudentIds.length === availableStudents.length) {
            setSelectedStudentIds([]);
        } else {
            setSelectedStudentIds(availableStudents.map((s) => s.id));
        }
    }

    if (loading) {
        return (
            <div className="p-6">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading enrollment data...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link href="/admin/batches" className="text-sm text-gray-600 hover:text-gray-900">
                            ← Batches
                        </Link>
                    </div>
                    <h1 className="text-3xl font-semibold text-gray-900">Student Enrollments</h1>
                    <p className="text-gray-600">Enroll students to batches or manage existing enrollments</p>
                </div>
            </div>

            {/* Success Message */}
            {successMessage && (
                <div className="rounded-md bg-green-50 border border-green-200 p-4 animate-fade-in">
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

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Enrollments" value={stats.total} color="purple" />
                <StatCard title="Active" value={stats.active} color="green" />
                <StatCard title="Completed" value={stats.completed} color="blue" />
                <StatCard title="Dropped" value={stats.dropped} color="red" />
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="border-b border-gray-200">
                    <nav className="flex -mb-px">
                        <button
                            onClick={() => setActiveTab('enroll')}
                            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'enroll'
                                    ? 'border-purple-600 text-purple-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                                Bulk Enroll
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('manage')}
                            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'manage'
                                    ? 'border-purple-600 text-purple-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                Manage Enrollments
                            </span>
                        </button>
                    </nav>
                </div>

                {/* Bulk Enroll Tab */}
                {activeTab === 'enroll' && (
                    <div className="p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Step 1: Select Batch */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-600 font-semibold text-sm">
                                        1
                                    </span>
                                    <h3 className="text-lg font-medium text-gray-900">Select Batch</h3>
                                </div>
                                <select
                                    value={selectedBatchId}
                                    onChange={(e) => {
                                        setSelectedBatchId(e.target.value);
                                        setSelectedStudentIds([]);
                                    }}
                                    className="w-full rounded-md border border-gray-300 px-3 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                >
                                    <option value="">Choose a batch...</option>
                                    {batches.map((batch) => (
                                        <option key={batch.id} value={batch.id}>
                                            {batch.courses?.code ? `${batch.courses.code} - ` : ''}
                                            {batch.name}
                                            {batch.courses?.name ? ` (${batch.courses.name})` : ''}
                                        </option>
                                    ))}
                                </select>
                                {selectedBatchId && (
                                    <div className="p-4 bg-purple-50 rounded-lg">
                                        <p className="text-sm text-purple-800">
                                            <strong>
                                                {enrolledStudentIdsForBatch.size} student(s)
                                            </strong>{' '}
                                            already enrolled in this batch
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Step 2: Select Students */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-600 font-semibold text-sm">
                                            2
                                        </span>
                                        <h3 className="text-lg font-medium text-gray-900">Select Students</h3>
                                    </div>
                                    {selectedBatchId && availableStudents.length > 0 && (
                                        <button
                                            onClick={handleSelectAllStudents}
                                            className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                                        >
                                            {selectedStudentIds.length === availableStudents.length
                                                ? 'Deselect All'
                                                : 'Select All'}
                                        </button>
                                    )}
                                </div>
                                <div className="border border-gray-200 rounded-md max-h-80 overflow-y-auto">
                                    {!selectedBatchId ? (
                                        <div className="p-6 text-center text-gray-500">
                                            <svg className="mx-auto h-12 w-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                                            </svg>
                                            <p className="text-sm">Select a batch first</p>
                                        </div>
                                    ) : availableStudents.length === 0 ? (
                                        <div className="p-6 text-center text-gray-500">
                                            <svg className="mx-auto h-12 w-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <p className="text-sm">All students are enrolled in this batch</p>
                                        </div>
                                    ) : (
                                        <ul className="divide-y divide-gray-200">
                                            {availableStudents.map((student) => (
                                                <li key={student.id}>
                                                    <label className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedStudentIds.includes(student.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedStudentIds([...selectedStudentIds, student.id]);
                                                                } else {
                                                                    setSelectedStudentIds(
                                                                        selectedStudentIds.filter((id) => id !== student.id)
                                                                    );
                                                                }
                                                            }}
                                                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                                        />
                                                        <div className="ml-3">
                                                            <p className="text-sm font-medium text-gray-900">
                                                                {displayName(student)}
                                                            </p>
                                                            <p className="text-xs text-gray-500">{student.email}</p>
                                                        </div>
                                                    </label>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Enroll Button */}
                        <div className="mt-6 flex items-center justify-between pt-6 border-t border-gray-200">
                            <p className="text-sm text-gray-600">
                                {selectedStudentIds.length > 0 ? (
                                    <>
                                        <strong>{selectedStudentIds.length}</strong> student(s) selected for enrollment
                                    </>
                                ) : (
                                    'Select students to enroll'
                                )}
                            </p>
                            <button
                                onClick={handleBulkEnroll}
                                disabled={saving || !selectedBatchId || selectedStudentIds.length === 0}
                                className="inline-flex items-center gap-2 rounded-md bg-purple-600 text-white px-6 py-3 text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {saving ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Enrolling...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                        </svg>
                                        Enroll Students
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Manage Enrollments Tab */}
                {activeTab === 'manage' && (
                    <div className="p-6">
                        {/* Filters */}
                        <div className="flex flex-col md:flex-row gap-4 mb-6">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    placeholder="Search by student name, batch, or course..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                            <select
                                value={filterBatchId}
                                onChange={(e) => setFilterBatchId(e.target.value)}
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            >
                                <option value="">All Batches</option>
                                {batches.map((batch) => (
                                    <option key={batch.id} value={batch.id}>
                                        {batch.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            >
                                <option value="">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                                <option value="dropped">Dropped</option>
                            </select>
                        </div>

                        {/* Enrollments Table */}
                        {filteredEnrollments.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <p>No enrollments found</p>
                                <p className="text-sm text-gray-400 mt-1">
                                    {enrollments.length === 0
                                        ? 'Start by enrolling students to batches'
                                        : 'Try adjusting your filters'}
                                </p>
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
                                                Batch
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Course
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Enrolled
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
                                        {filteredEnrollments.map((enrollment) => (
                                            <tr key={enrollment.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {displayName(enrollment.profiles)}
                                                        </p>
                                                        <p className="text-xs text-gray-500">{enrollment.profiles?.email}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900">
                                                    {enrollment.batches?.name || '—'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {enrollment.batches?.courses?.code
                                                        ? `${enrollment.batches.courses.code} - ${enrollment.batches.courses.name}`
                                                        : enrollment.batches?.courses?.name || '—'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {new Date(enrollment.enrolled_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${enrollment.status === 'active'
                                                                ? 'bg-green-100 text-green-800'
                                                                : enrollment.status === 'completed'
                                                                    ? 'bg-blue-100 text-blue-800'
                                                                    : 'bg-red-100 text-red-800'
                                                            }`}
                                                    >
                                                        {enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-medium">
                                                    <div className="flex justify-end gap-2">
                                                        {enrollment.status !== 'active' && (
                                                            <button
                                                                className="text-green-600 hover:text-green-800 disabled:opacity-50"
                                                                onClick={() => updateEnrollmentStatus(enrollment.id, 'active')}
                                                                disabled={saving}
                                                            >
                                                                Activate
                                                            </button>
                                                        )}
                                                        {enrollment.status === 'active' && (
                                                            <>
                                                                <button
                                                                    className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                                                    onClick={() => updateEnrollmentStatus(enrollment.id, 'completed')}
                                                                    disabled={saving}
                                                                >
                                                                    Complete
                                                                </button>
                                                                <button
                                                                    className="text-red-600 hover:text-red-800 disabled:opacity-50"
                                                                    onClick={() => updateEnrollmentStatus(enrollment.id, 'dropped')}
                                                                    disabled={saving}
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

                        <div className="mt-4 text-sm text-gray-500">
                            Showing {filteredEnrollments.length} of {enrollments.length} enrollments
                        </div>
                    </div>
                )}
            </div>
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
    color: 'purple' | 'green' | 'blue' | 'red';
}) {
    const colorClasses: Record<string, string> = {
        purple: 'bg-purple-50 text-purple-600 border-purple-200',
        green: 'bg-green-50 text-green-600 border-green-200',
        blue: 'bg-blue-50 text-blue-600 border-blue-200',
        red: 'bg-red-50 text-red-600 border-red-200',
    };

    return (
        <div className={`rounded-lg border p-6 ${colorClasses[color]}`}>
            <p className="text-sm font-medium opacity-75">{title}</p>
            <p className="text-3xl font-semibold mt-1">{value.toLocaleString()}</p>
        </div>
    );
}
