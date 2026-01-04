/**
 * Institute API: Batch Assignments Management
 * 
 * Endpoints for creating and managing assignments within a batch.
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

interface CreateAssignmentRequest {
  title: string;
  description?: string;
  dueDate: string; // ISO timestamp
  submissionDeadline: string; // ISO timestamp
  maxMarks: number;
  isActive?: boolean;
}

/**
 * POST /api/institute/batches/[batchId]/assignments
 * 
 * Create a new assignment for a batch
 * 
 * Access: Institute Admin and assigned Teachers
 * Enforced by: RLS policies
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { batchId: string } }
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

    const { batchId } = params;

    if (!batchId) {
      throw new ValidationError('Batch ID is required');
    }

    // Parse request body
    const body: CreateAssignmentRequest = await request.json();
    const {
      title,
      description,
      dueDate,
      submissionDeadline,
      maxMarks,
      isActive = true,
    } = body;

    // Validation
    if (!title?.trim()) {
      throw new ValidationError('Assignment title is required');
    }
    if (!dueDate) {
      throw new ValidationError('Due date is required');
    }
    if (!submissionDeadline) {
      throw new ValidationError('Submission deadline is required');
    }
    if (!maxMarks || maxMarks < 1) {
      throw new ValidationError('Max marks must be a positive integer');
    }

    // Validate dates
    const due = new Date(dueDate);
    const deadline = new Date(submissionDeadline);

    if (isNaN(due.getTime()) || isNaN(deadline.getTime())) {
      throw new ValidationError('Invalid date format');
    }

    if (deadline < due) {
      throw new ValidationError('Submission deadline must be after due date');
    }

    // Verify batch exists and belongs to institute
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('id, course_id, name')
      .eq('id', batchId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (batchError || !batch) {
      throw new NotFoundError('Batch not found');
    }

    // Create assignment (RLS will enforce access control)
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('assignments')
      .insert({
        institute_id: instituteId,
        batch_id: batchId,
        course_id: batch.course_id,
        title: title.trim(),
        description: description?.trim() || null,
        due_date: dueDate,
        submission_deadline: submissionDeadline,
        max_marks: maxMarks,
        is_active: isActive,
        created_by: userId,
      })
      .select(`
        *,
        batches(name),
        courses(name, code)
      `)
      .single();

    if (assignmentError) {
      throw new Error(`Failed to create assignment: ${assignmentError.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: assignment,
      },
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * GET /api/institute/batches/[batchId]/assignments
 * 
 * List all assignments for a batch
 * 
 * Access: Institute Admin, assigned Teachers, enrolled Students
 * Enforced by: RLS policies
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
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

    const { batchId } = params;

    if (!batchId) {
      throw new ValidationError('Batch ID is required');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    // Build query (RLS will filter automatically based on user role)
    let query = supabaseAdmin
      .from('assignments')
      .select(`
        *,
        batches(name),
        courses(name, code),
        profiles!assignments_created_by_fkey(
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('batch_id', batchId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('due_date', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: assignments, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch assignments: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: assignments || [],
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

