/**
 * Student Assignment Detail Page
 *
 * Fixes missing dynamic route used by `/student/assignments` "Submit/View" action.
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

type SubmissionResponse = {
  id: string;
  submitted_at: string;
  marks: number | null;
  evaluated_at: string | null;
  is_late: boolean;
  file_name: string | null;
  file_size: number | null;
  feedback?: string | null;
  signed_url?: string | null;
  assignments?: Assignment | null;
};

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed: ${res.status}`);
  return json as T;
}

export default function StudentAssignmentDetailPage({
  params,
}: {
  params: { assignmentId: string };
}) {
  const assignmentId = params.assignmentId;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    // Always load assignment first (student access is RLS-protected)
    const assignmentRes = await readJson<{ success: boolean; data: Assignment }>(
      `/api/institute/assignments/${assignmentId}`
    );
    setAssignment(assignmentRes.data || null);

    // Try to load submission (404 is expected when not submitted)
    try {
      const submissionRes = await readJson<{ success: boolean; data: SubmissionResponse }>(
        `/api/student/assignments/${assignmentId}/submission?includeSignedUrl=true`
      );
      setSubmission(submissionRes.data || null);
    } catch {
      setSubmission(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError('');
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load assignment');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  const canSubmit = useMemo(() => {
    if (!assignment) return false;
    if (submission) return false;
    if (!assignment.is_active) return false;
    if (!assignment.submission_deadline) return false;
    const deadline = new Date(assignment.submission_deadline);
    return new Date() <= deadline;
  }, [assignment, submission]);

  const submit = async () => {
    if (!file) {
      setError('Please choose a file to submit');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/student/assignments/${assignmentId}/submit`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Submit failed: ${res.status}`);

      setFile(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit assignment');
    } finally {
      setSubmitting(false);
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
            <Link href="/student/assignments" className="text-sm text-gray-600 hover:text-gray-900">
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
        {submission ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Submitted
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending
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
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Info title="Due Date" value={new Date(assignment.due_date).toLocaleDateString()} />
            <Info
              title="Submission Deadline"
              value={
                assignment.submission_deadline
                  ? new Date(assignment.submission_deadline).toLocaleString()
                  : '—'
              }
            />
            <Info title="Max Marks" value={assignment.max_marks !== null ? String(assignment.max_marks) : '—'} />
          </div>
          {assignment.description && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{assignment.description}</p>
            </div>
          )}
        </div>
      )}

      {!assignment && !error && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <p className="text-gray-700">Assignment not found.</p>
        </div>
      )}

      {assignment && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900">Your Submission</h2>

          {submission ? (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Info title="Submitted At" value={new Date(submission.submitted_at).toLocaleString()} />
                <Info title="Late" value={submission.is_late ? 'Yes' : 'No'} />
                <Info
                  title="Marks"
                  value={
                    submission.marks !== null && submission.marks !== undefined
                      ? `${submission.marks}${assignment.max_marks ? ` / ${assignment.max_marks}` : ''}`
                      : 'Pending'
                  }
                />
                <Info title="Evaluated" value={submission.evaluated_at ? 'Yes' : 'No'} />
              </div>

              {submission.signed_url && (
                <div className="pt-2">
                  <a
                    href={submission.signed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    Download submitted file
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-gray-600">
                Upload your work (PDF, DOC, DOCX). Submissions cannot be overwritten.
              </p>

              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-700"
                disabled={!canSubmit || submitting}
              />

              {!canSubmit && (
                <p className="text-sm text-gray-500">
                  Submission is not available (already submitted, inactive, or deadline passed).
                </p>
              )}

              <button
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Assignment'}
              </button>
            </div>
          )}
        </div>
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


