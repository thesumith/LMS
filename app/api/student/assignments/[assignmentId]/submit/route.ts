/**
 * Student API: Assignment Submission
 * 
 * Endpoint for students to submit assignments.
 * Access: Students only (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTenantApiContext } from '@/lib/api/context';
import {
  formatErrorResponse,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '@/lib/errors/api-errors';
import {
  generateAssignmentSubmissionPath,
  uploadContentFile,
  deleteContentFile,
} from '@/lib/storage/content';

/**
 * POST /api/student/assignments/[assignmentId]/submit
 * 
 * Submit an assignment
 * 
 * Access: Students only
 * One submission per assignment
 * Enforced by: RLS policies
 */
export async function POST(
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

    // Verify assignment exists and student is enrolled in batch
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('assignments')
      .select(`
        id,
        batch_id,
        submission_deadline,
        max_marks,
        batches!inner(
          id,
          batch_students!inner(
            student_id,
            status
          )
        )
      `)
      .eq('id', assignmentId)
      .eq('institute_id', instituteId)
      .eq('batches.batch_students.student_id', userId)
      .eq('batches.batch_students.status', 'active')
      .is('deleted_at', null)
      .single();

    if (assignmentError || !assignment) {
      throw new NotFoundError(
        'Assignment not found or you are not enrolled in this batch'
      );
    }

    // Check if student has already submitted
    const { data: existingSubmission } = await supabaseAdmin
      .from('assignment_submissions')
      .select('id, storage_path')
      .eq('assignment_id', assignmentId)
      .eq('student_id', userId)
      .is('deleted_at', null)
      .single();

    if (existingSubmission) {
      throw new ConflictError(
        'You have already submitted this assignment. Submissions cannot be overwritten.'
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      throw new ValidationError('File is required');
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new ValidationError(
        'Invalid file type. Only PDF and DOC/DOCX files are allowed.'
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new ValidationError('File size exceeds 10MB limit');
    }

    // Generate storage path
    const storagePath = generateAssignmentSubmissionPath(
      instituteId,
      assignmentId,
      userId,
      file.name
    );

    // Upload file (RLS will enforce access control)
    const uploadResult = await uploadContentFile(
      file,
      storagePath,
      file.type
    );

    if (uploadResult.error) {
      throw new Error(`Failed to upload file: ${uploadResult.error}`);
    }

    // Determine if submission is late
    const submissionDate = new Date();
    const deadline = new Date(assignment.submission_deadline);
    const isLate = submissionDate > deadline;

    // Create submission record (RLS will enforce access control)
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('assignment_submissions')
      .insert({
        institute_id: instituteId,
        assignment_id: assignmentId,
        batch_id: assignment.batch_id,
        student_id: userId,
        storage_path: uploadResult.path,
        file_name: file.name,
        file_size: file.size,
        submitted_at: submissionDate.toISOString(),
        is_late: isLate,
      })
      .select(`
        *,
        assignments(title, max_marks),
        batches(name),
        courses(name, code)
      `)
      .single();

    if (submissionError) {
      // Rollback: Delete uploaded file
      await deleteContentFile(uploadResult.path);
      throw new Error(`Failed to create submission: ${submissionError.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        message: isLate
          ? 'Assignment submitted successfully (marked as late)'
          : 'Assignment submitted successfully',
        data: submission,
      },
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

