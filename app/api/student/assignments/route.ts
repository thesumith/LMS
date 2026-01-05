/**
 * Student API: List Assignments
 * 
 * Endpoint for students to view all their assignments across enrolled batches.
 * Access: Students only (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  formatErrorResponse,
  UnauthorizedError,
} from '@/lib/errors/api-errors';

/**
 * GET /api/student/assignments
 * 
 * Get all assignments for student's enrolled batches
 * 
 * Query Parameters:
 * - batchId: Filter by batch
 * - status: Filter by submission status ('submitted', 'pending', 'overdue')
 * - activeOnly: Filter active assignments only
 * 
 * Access: Students only
 * Enforced by: RLS policies
 */
export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');
    const status = searchParams.get('status');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    // First, get all enrolled batches
    let batchesQuery = supabaseAdmin
      .from('batch_students')
      .select('batch_id')
      .eq('student_id', userId)
      .eq('institute_id', instituteId)
      .eq('status', 'active')
      .is('deleted_at', null);

    const { data: enrollments, error: enrollmentsError } = await batchesQuery;

    if (enrollmentsError) {
      throw new Error(`Failed to fetch enrollments: ${enrollmentsError.message}`);
    }

    const batchIds = (enrollments || []).map((e: any) => e.batch_id);

    if (batchIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Build assignments query
    let assignmentsQuery = supabaseAdmin
      .from('assignments')
      .select(`
        *,
        batches(id, name),
        courses(id, name, code),
        assignment_submissions!left(
          id,
          submitted_at,
          marks,
          evaluated_at,
          is_late
        )
      `)
      .in('batch_id', batchIds)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('due_date', { ascending: true });

    if (batchId) {
      assignmentsQuery = assignmentsQuery.eq('batch_id', batchId);
    }

    if (activeOnly) {
      assignmentsQuery = assignmentsQuery.eq('is_active', true);
    }

    const { data: assignments, error: assignmentsError } = await assignmentsQuery;

    if (assignmentsError) {
      throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`);
    }

    // Filter by submission status if provided
    let filteredAssignments = assignments || [];

    if (status) {
      const now = new Date();
      filteredAssignments = filteredAssignments.filter((assignment: any) => {
        const submissions = assignment.assignment_submissions || [];
        const submission = submissions.length > 0 ? submissions[0] : null;
        const dueDate = new Date(assignment.due_date);

        if (status === 'submitted') {
          return submission && submission.submitted_at;
        } else if (status === 'pending') {
          return !submission && dueDate >= now;
        } else if (status === 'overdue') {
          return !submission && dueDate < now;
        }
        return true;
      });
    }

    // Transform data to include submission info
    const transformedAssignments = filteredAssignments.map((assignment: any) => {
      const submissions = assignment.assignment_submissions || [];
      const submission = submissions.length > 0 ? submissions[0] : null;

      return {
        ...assignment,
        submission: submission || null,
        assignment_submissions: undefined, // Remove nested data
      };
    });

    return NextResponse.json({
      success: true,
      data: transformedAssignments,
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

