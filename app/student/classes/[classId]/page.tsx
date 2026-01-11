/**
 * Student Class Details + Materials
 *
 * Server Component. All reads are RLS-enforced.
 */

import { headers } from 'next/headers';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSignedUrl } from '@/lib/storage/content';

export default async function StudentClassDetailPage({ params }: { params: { classId: string } }) {
  const headersList = await headers();
  const instituteId = headersList.get('x-institute-id');
  const userId = headersList.get('x-user-id');

  if (!instituteId || !userId) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-2xl font-semibold mb-4 text-red-900">Access Denied</h1>
            <p className="text-gray-700">Institute context or authentication required.</p>
          </div>
        </div>
      </div>
    );
  }

  const classId = params.classId;
  const supabase = await createSupabaseServerClient();

  const { data: cs, error: csError } = await supabase
    .from('class_sessions')
    .select(
      `
      id,
      title,
      description,
      scheduled_at,
      duration_minutes,
      meeting_link,
      is_cancelled,
      batches(name),
      courses(name, code),
      profiles!class_sessions_teacher_id_fkey(id, email, first_name, last_name)
    `
    )
    .eq('id', classId)
    .eq('institute_id', instituteId)
    .is('deleted_at', null)
    .single();

  if (csError || !cs) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h1 className="text-xl font-semibold text-gray-900">Class not found</h1>
            <p className="text-sm text-gray-600 mt-2">You may not have access to this class.</p>
            <div className="mt-4">
              <Link href="/student/classes" className="text-blue-600 hover:text-blue-900">
                ← Back to Classes
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { data: materials, error: mError } = await supabase
    .from('class_session_materials')
    .select(
      `
      id,
      title,
      storage_path,
      content_type,
      file_size_bytes,
      created_at,
      profiles!class_session_materials_uploaded_by_fkey(id, email, first_name, last_name)
    `
    )
    .eq('institute_id', instituteId)
    .eq('class_session_id', classId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (mError) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-red-600">{mError.message}</p>
      </div>
    );
  }

  const enriched = await Promise.all(
    (materials || []).map(async (m: any) => {
      const { url } = await getSignedUrl(m.storage_path, 3600);
      return { ...m, signed_url: url };
    })
  );

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/student/classes" className="text-sm text-gray-600 hover:text-gray-900">
              ← Back
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-600">Class</span>
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 mt-2">{cs.title}</h1>
          <p className="text-gray-600">
            {(() => {
              const course = Array.isArray(cs.courses) ? cs.courses[0] : cs.courses;
              const batch = Array.isArray(cs.batches) ? cs.batches[0] : cs.batches;
              return (
                <>
                  {course?.code ? `${course.code} — ` : ''}
                  {course?.name || '—'} • {batch?.name || '—'}
                </>
              );
            })()}
          </p>
        </div>
        <a
          href={cs.meeting_link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          Join Class
        </a>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Scheduled</p>
            <p className="text-sm text-gray-900 mt-1">{new Date(cs.scheduled_at).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Duration</p>
            <p className="text-sm text-gray-900 mt-1">{cs.duration_minutes ? `${cs.duration_minutes} min` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
            <p className="text-sm text-gray-900 mt-1">{cs.is_cancelled ? 'Cancelled' : 'Scheduled'}</p>
          </div>
        </div>
        {cs.description && <p className="text-sm text-gray-700 mt-4 whitespace-pre-wrap">{cs.description}</p>}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Materials</h2>
          <span className="text-sm text-gray-500">{enriched.length} files</span>
        </div>
        {enriched.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">No materials uploaded yet.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {enriched.map((m: any) => (
              <div key={m.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
                <a
                  href={m.signed_url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className={`text-sm font-medium ${m.signed_url ? 'text-blue-600 hover:text-blue-900' : 'text-gray-400'}`}
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


