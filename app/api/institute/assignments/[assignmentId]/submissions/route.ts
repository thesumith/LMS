/**
 * Institute API: Assignment Submissions Management
 * 
 * Endpoints for viewing and evaluating submissions.
 * Access: Institute Admin and assigned Teachers (enforced by RLS).
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

interface EvaluateSubmissionRequest {
  submissionId: string;
  marks: number;
  feedback?: string;
}

/**
 * GET /api/institute/assignments/[assignmentId]/submissions
 * 
 * Get all submissions for an assignment
 * 
 * Access: Institute Admin and assigned Teachers
 * Enforced by: RLS policies
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const { instituteId } = await requireTenantApiContext(request);

    const { assignmentId } = params;

    if (!assignmentId) {
      throw new ValidationError('Assignment ID is required');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const includeSignedUrls = searchParams.get('includeSignedUrls') === 'true';
    const evaluatedOnly = searchParams.get('evaluated') === 'true';
    const lateOnly = searchParams.get('late') === 'true';

    // Build query (RLS will filter to batches teacher is assigned to)
    let query = supabaseAdmin
      .from('assignment_submissions')
      .select(`
        *,
        assignments(title, max_marks, submission_deadline),
        profiles!assignment_submissions_student_id_fkey(
          id,
          email,
          first_name,
          last_name
        ),
        batches(name)
      `)
      .eq('assignment_id', assignmentId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('submitted_at', { ascending: false });

    if (evaluatedOnly) {
      query = query.not('evaluated_at', 'is', null);
    }

    if (lateOnly) {
      query = query.eq('is_late', true);
    }

    const { data: submissions, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch submissions: ${error.message}`);
    }

    // Generate signed URLs if requested
    if (includeSignedUrls && submissions) {
      const submissionsWithUrls = await Promise.all(
        submissions.map(async (submission: any) => {
          if (submission.storage_path) {
            const { url } = await getSignedUrl(submission.storage_path, 3600); // 1 hour expiry
            return {
              ...submission,
              signed_url: url,
              // Don't expose storage_path to client
              storage_path: undefined,
            };
          }
          return submission;
        })
      );

      return NextResponse.json({
        success: true,
        data: submissionsWithUrls,
      });
    }

    return NextResponse.json({
      success: true,
      data: submissions || [],
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * PATCH /api/institute/assignments/[assignmentId]/submissions
 * 
 * Evaluate a submission (add marks and feedback)
 * 
 * Access: Institute Admin and assigned Teachers
 * Enforced by: RLS policies
 */
export async function PATCH(
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

    // Parse request body
    const body: EvaluateSubmissionRequest = await request.json();
    const { submissionId, marks, feedback } = body;

    // Validation
    if (!submissionId?.trim()) {
      throw new ValidationError('Submission ID is required');
    }
    if (marks === undefined || marks === null) {
      throw new ValidationError('Marks are required');
    }
    if (marks < 0) {
      throw new ValidationError('Marks cannot be negative');
    }

    // Verify assignment exists and get max marks
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('assignments')
      .select('id, max_marks, batch_id')
      .eq('id', assignmentId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (assignmentError || !assignment) {
      throw new NotFoundError('Assignment not found');
    }

    if (marks > assignment.max_marks) {
      throw new ValidationError(
        `Marks cannot exceed maximum marks (${assignment.max_marks})`
      );
    }

    // Verify submission exists and belongs to assignment
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('assignment_submissions')
      .select('id, student_id, marks')
      .eq('id', submissionId)
      .eq('assignment_id', assignmentId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (submissionError || !submission) {
      throw new NotFoundError('Submission not found');
    }

    // Update submission with marks and feedback (RLS will enforce access control)
    const { data: updatedSubmission, error: updateError } = await supabaseAdmin
      .from('assignment_submissions')
      .update({
        marks,
        feedback: feedback?.trim() || null,
        evaluated_at: new Date().toISOString(),
        evaluated_by: userId,
      })
      .eq('id', submissionId)
      .select(`
        *,
        assignments(title, max_marks),
        profiles!assignment_submissions_student_id_fkey(
          id,
          email,
          first_name,
          last_name
        ),
        batches(name)
      `)
      .single();

    if (updateError) {
      throw new Error(`Failed to evaluate submission: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: updatedSubmission,
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

