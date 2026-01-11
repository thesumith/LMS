/**
 * Student API: View Own Submission
 * 
 * Endpoint for students to view their own submission and marks.
 * Access: Students only (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTenantApiContext } from '@/lib/api/context';
import {
  formatErrorResponse,
  ValidationError,
  NotFoundError,
} from '@/lib/errors/api-errors';
import { getSignedUrl } from '@/lib/storage/content';

/**
 * GET /api/student/assignments/[assignmentId]/submission
 * 
 * Get student's own submission for an assignment
 * 
 * Access: Students only
 * Enforced by: RLS policies
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const { instituteId, session } = await requireTenantApiContext(request);
    const userId = session.userId;

    const { assignmentId } = params;

    if (!assignmentId) {
      throw new ValidationError('Assignment ID is required');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const includeSignedUrl = searchParams.get('includeSignedUrl') === 'true';

    // Fetch submission (RLS will filter to student's own submissions)
    const { data: submission, error } = await supabaseAdmin
      .from('assignment_submissions')
      .select(`
        *,
        assignments(
          id,
          title,
          description,
          due_date,
          submission_deadline,
          max_marks,
          batches(name),
          courses(name, code)
        )
      `)
      .eq('assignment_id', assignmentId)
      .eq('student_id', userId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (error || !submission) {
      throw new NotFoundError('Submission not found');
    }

    // Generate signed URL if requested
    let signedUrl: string | null = null;
    if (includeSignedUrl && submission.storage_path) {
      const { url } = await getSignedUrl(submission.storage_path, 3600); // 1 hour expiry
      signedUrl = url;
    }

    return NextResponse.json({
      success: true,
      data: {
        ...submission,
        signed_url: signedUrl,
        // Don't expose storage_path to client
        storage_path: undefined,
      },
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

