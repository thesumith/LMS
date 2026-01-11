/**
 * Student Classes
 *
 * Server Component for listing class sessions the student can access (RLS enforced).
 */

import { headers } from 'next/headers';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function StudentClassesPage() {
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

  const supabase = await createSupabaseServerClient();
  const { data: classes, error } = await supabase
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
    .eq('institute_id', instituteId)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: false })
    .limit(50);

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-red-600">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Classes</h1>
          <p className="text-gray-600">Upcoming and past scheduled classes</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">All Classes</h2>
          <span className="text-sm text-gray-500">{(classes || []).length} shown</span>
        </div>

        {(classes || []).length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">No classes scheduled yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    When
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Batch / Course
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(classes || []).map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        <span>{c.title}</span>
                        {c.is_cancelled && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Cancelled
                          </span>
                        )}
                      </div>
                      {c.description && <div className="text-sm text-gray-500 mt-1 line-clamp-2">{c.description}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(c.scheduled_at).toLocaleString()}
                      {c.duration_minutes ? (
                        <div className="text-xs text-gray-500 mt-0.5">{c.duration_minutes} min</div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(() => {
                        const batch = Array.isArray(c.batches) ? c.batches[0] : c.batches;
                        const course = Array.isArray(c.courses) ? c.courses[0] : c.courses;
                        return (
                          <>
                            <div className="text-sm text-gray-900">{batch?.name || '—'}</div>
                            <div className="text-xs text-gray-500">
                              {course?.code ? `${course.code} — ` : ''}
                              {course?.name || '—'}
                            </div>
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      <a
                        href={c.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Join
                      </a>
                      <Link href={`/student/classes/${c.id}`} className="text-gray-700 hover:text-gray-900">
                        Materials
                      </Link>
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


