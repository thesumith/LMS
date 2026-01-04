/**
 * Teacher API: Batch Students
 * 
 * Endpoint for teachers to view students enrolled in their batches.
 * Teachers can only see students in batches they are assigned to.
 * Enforced by: RLS policies
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  formatErrorResponse,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '@/lib/errors/api-errors';

/**
 * GET /api/teacher/batches/[batchId]/students
 * 
 * Get all students enrolled in a batch
 * 
 * Access: Teachers assigned to the batch only
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

    // Verify batch exists and teacher is assigned to it
    // RLS will enforce this, but we check here for better error messages
    const { data: batchAssignment, error: assignmentError } = await supabaseAdmin
      .from('batch_teachers')
      .select(`
        batch_id,
        batches!inner(
          id,
          name,
          start_date,
          end_date,
          courses(name, code)
        )
      `)
      .eq('batch_id', batchId)
      .eq('teacher_id', userId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (assignmentError || !batchAssignment) {
      throw new ForbiddenError(
        'You are not assigned to this batch or batch does not exist'
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'active' | 'completed' | 'dropped' | null;

    // Fetch enrolled students (RLS will enforce teacher can only see their batches)
    let studentsQuery = supabaseAdmin
      .from('batch_students')
      .select(`
        id,
        student_id,
        status,
        enrolled_at,
        completed_at,
        dropped_at,
        profiles!batch_students_student_id_fkey(
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('batch_id', batchId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('enrolled_at', { ascending: false });

    if (status) {
      studentsQuery = studentsQuery.eq('status', status);
    }

    const { data: students, error: studentsError } = await studentsQuery;

    if (studentsError) {
      throw new Error(`Failed to fetch students: ${studentsError.message}`);
    }

    // Calculate statistics
    const total = students?.length || 0;
    const active = students?.filter((s) => s.status === 'active').length || 0;
    const completed = students?.filter((s) => s.status === 'completed').length || 0;
    const dropped = students?.filter((s) => s.status === 'dropped').length || 0;

    return NextResponse.json({
      success: true,
      data: {
        batch: batchAssignment.batches,
        students: students || [],
        statistics: {
          total,
          active,
          completed,
          dropped,
        },
      },
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

