/**
 * Institute API: Assignment Management
 * 
 * Endpoints for updating and deleting assignments.
 * Access: Institute Admin and assigned Teachers (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  formatErrorResponse,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '@/lib/errors/api-errors';

interface UpdateAssignmentRequest {
  title?: string;
  description?: string;
  dueDate?: string;
  submissionDeadline?: string;
  maxMarks?: number;
  isActive?: boolean;
}

/**
 * PATCH /api/institute/assignments/[assignmentId]
 * 
 * Update an assignment
 * 
 * Access: Institute Admin and assigned Teachers
 * Can only edit if no submissions exist yet
 * Enforced by: RLS policies
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const headersList = await headers();
    const instituteId = headersList.get('x-institute-id');
    const userId = headersList.get('x-user-id');

    if (!instituteId) {
      throw new UnauthorizedError('Institute context required');
    }

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { assignmentId } = params;

    if (!assignmentId) {
      throw new ValidationError('Assignment ID is required');
    }

    // Verify assignment exists
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('assignments')
      .select('id, created_by, batch_id, due_date, submission_deadline, max_marks')
      .eq('id', assignmentId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (assignmentError || !assignment) {
      throw new NotFoundError('Assignment not found');
    }

    // Check if assignment can be edited (no submissions yet)
    const { data: canEdit, error: canEditError } = await supabaseAdmin
      .rpc('can_edit_assignment', { p_assignment_id: assignmentId });

    if (canEditError || !canEdit) {
      throw new ConflictError(
        'Cannot edit assignment. One or more students have already submitted.'
      );
    }

    // Parse request body
    const body: UpdateAssignmentRequest = await request.json();
    const updateData: any = {};

    if (body.title !== undefined) {
      if (!body.title?.trim()) {
        throw new ValidationError('Title cannot be empty');
      }
      updateData.title = body.title.trim();
    }

    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }

    if (body.dueDate !== undefined) {
      const due = new Date(body.dueDate);
      if (isNaN(due.getTime())) {
        throw new ValidationError('Invalid due date format');
      }
      updateData.due_date = body.dueDate;
    }

    if (body.submissionDeadline !== undefined) {
      const deadline = new Date(body.submissionDeadline);
      if (isNaN(deadline.getTime())) {
        throw new ValidationError('Invalid submission deadline format');
      }
      updateData.submission_deadline = body.submissionDeadline;
    }

    if (body.maxMarks !== undefined) {
      if (body.maxMarks < 1) {
        throw new ValidationError('Max marks must be a positive integer');
      }
      updateData.max_marks = body.maxMarks;
    }

    if (body.isActive !== undefined) {
      updateData.is_active = body.isActive;
    }

    // Validate date relationship if both dates are being updated
    if (updateData.due_date && updateData.submission_deadline) {
      const due = new Date(updateData.due_date);
      const deadline = new Date(updateData.submission_deadline);
      if (deadline < due) {
        throw new ValidationError('Submission deadline must be after due date');
      }
    } else if (updateData.due_date) {
      const due = new Date(updateData.due_date);
      const deadline = new Date(assignment.submission_deadline);
      if (deadline < due) {
        throw new ValidationError('Submission deadline must be after due date');
      }
    } else if (updateData.submission_deadline) {
      const due = new Date(assignment.due_date);
      const deadline = new Date(updateData.submission_deadline);
      if (deadline < due) {
        throw new ValidationError('Submission deadline must be after due date');
      }
    }

    // Update assignment (RLS will enforce access control)
    const { data: updatedAssignment, error: updateError } = await supabaseAdmin
      .from('assignments')
      .update(updateData)
      .eq('id', assignmentId)
      .select(`
        *,
        batches(name),
        courses(name, code)
      `)
      .single();

    if (updateError) {
      throw new Error(`Failed to update assignment: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: updatedAssignment,
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * GET /api/institute/assignments/[assignmentId]
 * 
 * Get assignment details
 * 
 * Access: Institute Admin, assigned Teachers, enrolled Students
 * Enforced by: RLS policies
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const headersList = await headers();
    const instituteId = headersList.get('x-institute-id');
    const userId = headersList.get('x-user-id');

    if (!instituteId) {
      throw new UnauthorizedError('Institute context required');
    }

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { assignmentId } = params;

    if (!assignmentId) {
      throw new ValidationError('Assignment ID is required');
    }

    // Fetch assignment (RLS will filter automatically)
    const { data: assignment, error } = await supabaseAdmin
      .from('assignments')
      .select(`
        *,
        batches(id, name, start_date, end_date),
        courses(id, name, code),
        profiles!assignments_created_by_fkey(
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('id', assignmentId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (error || !assignment) {
      throw new NotFoundError('Assignment not found or access denied');
    }

    return NextResponse.json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

