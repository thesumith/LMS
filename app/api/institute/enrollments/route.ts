/**
 * Institute API: Student Enrollments
 * 
 * Endpoints for enrolling students into batches.
 * Only accessible to Institute Admin (enforced by RLS).
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

interface EnrollStudentRequest {
  batchId: string;
  studentId: string;
}

interface UpdateEnrollmentRequest {
  enrollmentId: string;
  status: 'active' | 'completed' | 'dropped';
}

/**
 * POST /api/institute/enrollments
 * 
 * Enroll a student into a batch
 * 
 * Requires: Institute Admin role
 * Enforced by: RLS policies
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body: EnrollStudentRequest = await request.json();
    const { batchId, studentId } = body;

    // Validation
    if (!batchId?.trim()) {
      throw new ValidationError('Batch ID is required');
    }
    if (!studentId?.trim()) {
      throw new ValidationError('Student ID is required');
    }

    // Verify batch exists and belongs to institute
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('id, name, start_date, end_date')
      .eq('id', batchId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (batchError || !batch) {
      throw new NotFoundError('Batch not found');
    }

    // Verify student exists, belongs to institute, and has STUDENT role
    const { data: student, error: studentError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        email,
        first_name,
        last_name,
        user_roles!inner(
          roles!inner(name)
        )
      `)
      .eq('id', studentId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .eq('user_roles.roles.name', 'STUDENT')
      .eq('user_roles.deleted_at', null)
      .single();

    if (studentError || !student) {
      throw new NotFoundError('Student not found or does not have STUDENT role');
    }

    // Check if student is already enrolled
    const { data: existingEnrollment } = await supabaseAdmin
      .from('batch_students')
      .select('id, status')
      .eq('batch_id', batchId)
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .single();

    if (existingEnrollment) {
      if (existingEnrollment.status === 'active') {
        throw new ConflictError('Student is already enrolled in this batch');
      }
      // If previously dropped or completed, we can re-enroll by updating status
      // For now, we'll create a new enrollment (soft delete prevents duplicates)
      // In production, you might want to handle re-enrollment differently
    }

    // Create enrollment (RLS will enforce Institute Admin requirement)
    const { data: enrollment, error: enrollmentError } = await supabaseAdmin
      .from('batch_students')
      .insert({
        institute_id: instituteId,
        batch_id: batchId,
        student_id: studentId,
        status: 'active',
      })
      .select(`
        *,
        batches(
          id,
          name,
          start_date,
          end_date,
          courses(name, code)
        ),
        profiles!batch_students_student_id_fkey(
          id,
          email,
          first_name,
          last_name
        )
      `)
      .single();

    if (enrollmentError) {
      throw new Error(`Failed to enroll student: ${enrollmentError.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: enrollment,
      },
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * GET /api/institute/enrollments
 * 
 * List enrollments
 * 
 * Access:
 * - Institute Admin: All enrollments in institute
 * - Teacher: Enrollments in their batches
 * - Student: Their own enrollments
 * 
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
    const studentId = searchParams.get('studentId');
    const status = searchParams.get('status') as 'active' | 'completed' | 'dropped' | null;

    // Build query (RLS will filter automatically based on user role)
    let query = supabaseAdmin
      .from('batch_students')
      .select(`
        *,
        batches(
          id,
          name,
          start_date,
          end_date,
          courses(name, code)
        ),
        profiles!batch_students_student_id_fkey(
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('enrolled_at', { ascending: false });

    if (batchId) {
      query = query.eq('batch_id', batchId);
    }

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: enrollments, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch enrollments: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: enrollments || [],
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * PATCH /api/institute/enrollments
 * 
 * Update enrollment status
 * 
 * Access:
 * - Institute Admin: Can update any enrollment
 * - Teacher: Can update enrollments in their batches
 * 
 * Enforced by: RLS policies
 */
export async function PATCH(request: NextRequest) {
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

    // Parse request body
    const body: UpdateEnrollmentRequest = await request.json();
    const { enrollmentId, status } = body;

    // Validation
    if (!enrollmentId?.trim()) {
      throw new ValidationError('Enrollment ID is required');
    }
    if (!status || !['active', 'completed', 'dropped'].includes(status)) {
      throw new ValidationError('Invalid status. Must be: active, completed, or dropped');
    }

    // Verify enrollment exists
    const { data: enrollment, error: enrollmentError } = await supabaseAdmin
      .from('batch_students')
      .select('id, status, completed_at, dropped_at')
      .eq('id', enrollmentId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (enrollmentError || !enrollment) {
      throw new NotFoundError('Enrollment not found');
    }

    // Prepare update data
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Set status-specific timestamps
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
      updateData.dropped_at = null;
    } else if (status === 'dropped') {
      updateData.dropped_at = new Date().toISOString();
      updateData.completed_at = null;
    } else if (status === 'active') {
      updateData.completed_at = null;
      updateData.dropped_at = null;
    }

    // Update enrollment (RLS will enforce permissions)
    const { data: updatedEnrollment, error: updateError } = await supabaseAdmin
      .from('batch_students')
      .update(updateData)
      .eq('id', enrollmentId)
      .select(`
        *,
        batches(
          id,
          name,
          courses(name, code)
        ),
        profiles!batch_students_student_id_fkey(
          id,
          email,
          first_name,
          last_name
        )
      `)
      .single();

    if (updateError) {
      throw new Error(`Failed to update enrollment: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: updatedEnrollment,
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

