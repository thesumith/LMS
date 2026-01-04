/**
 * Institute API: Batch Teacher Assignment
 * 
 * Endpoints for assigning and removing teachers from batches.
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
} from '@/lib/errors/api-errors';

interface AssignTeachersRequest {
  teacherIds: string[];
}

/**
 * POST /api/institute/batches/[batchId]/teachers
 * 
 * Assign teachers to a batch
 * 
 * Requires: Institute Admin role
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
    const body: AssignTeachersRequest = await request.json();
    const { teacherIds } = body;

    // Validation
    if (!Array.isArray(teacherIds) || teacherIds.length === 0) {
      throw new ValidationError('At least one teacher ID is required');
    }

    // Remove duplicates
    const uniqueTeacherIds = [...new Set(teacherIds)];

    // Verify batch exists and belongs to institute
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('id, name, course_id')
      .eq('id', batchId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (batchError || !batch) {
      throw new NotFoundError('Batch not found');
    }

    // Verify all teachers exist, belong to institute, and have TEACHER role
    const { data: teachers, error: teachersError } = await supabaseAdmin
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
      .eq('institute_id', instituteId)
      .in('id', uniqueTeacherIds)
      .is('deleted_at', null)
      .eq('user_roles.roles.name', 'TEACHER')
      .eq('user_roles.deleted_at', null);

    if (teachersError) {
      throw new Error(`Failed to validate teachers: ${teachersError.message}`);
    }

    if (!teachers || teachers.length !== uniqueTeacherIds.length) {
      throw new ValidationError(
        'One or more teachers are invalid, not found, or do not have TEACHER role'
      );
    }

    // Check for existing assignments (to avoid duplicates)
    const { data: existingAssignments } = await supabaseAdmin
      .from('batch_teachers')
      .select('teacher_id')
      .eq('batch_id', batchId)
      .in('teacher_id', uniqueTeacherIds)
      .is('deleted_at', null);

    const existingTeacherIds = existingAssignments?.map((a) => a.teacher_id) || [];
    const newTeacherIds = uniqueTeacherIds.filter(
      (id) => !existingTeacherIds.includes(id)
    );

    if (newTeacherIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All teachers are already assigned to this batch',
        data: [],
      });
    }

    // Create teacher assignments (RLS will enforce Institute Admin requirement)
    const assignments = newTeacherIds.map((teacherId) => ({
      institute_id: instituteId,
      batch_id: batchId,
      teacher_id: teacherId,
    }));

    const { data: createdAssignments, error: assignmentError } = await supabaseAdmin
      .from('batch_teachers')
      .insert(assignments)
      .select(`
        *,
        profiles!batch_teachers_teacher_id_fkey(
          id,
          email,
          first_name,
          last_name
        )
      `);

    if (assignmentError) {
      throw new Error(`Failed to assign teachers: ${assignmentError.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        message: `Assigned ${newTeacherIds.length} teacher(s) to batch`,
        data: createdAssignments,
      },
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * GET /api/institute/batches/[batchId]/teachers
 * 
 * Get all teachers assigned to a batch
 * 
 * Access:
 * - Institute Admin: Can see all teachers
 * - Teacher: Can see if they are assigned to the batch
 * 
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

    // Fetch teachers assigned to batch (RLS will filter automatically)
    const { data: assignments, error } = await supabaseAdmin
      .from('batch_teachers')
      .select(`
        *,
        profiles!batch_teachers_teacher_id_fkey(
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('batch_id', batchId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch teachers: ${error.message}`);
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

/**
 * DELETE /api/institute/batches/[batchId]/teachers
 * 
 * Remove teachers from a batch (soft delete)
 * 
 * Requires: Institute Admin role
 * Enforced by: RLS policies
 */
export async function DELETE(
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

    // Get teacher IDs from query params
    const { searchParams } = new URL(request.url);
    const teacherIdsParam = searchParams.get('teacherIds');

    if (!teacherIdsParam) {
      throw new ValidationError('teacherIds query parameter is required');
    }

    const teacherIds = teacherIdsParam.split(',').map((id) => id.trim());

    if (teacherIds.length === 0) {
      throw new ValidationError('At least one teacher ID is required');
    }

    // Verify batch exists and belongs to institute
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('id')
      .eq('id', batchId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (batchError || !batch) {
      throw new NotFoundError('Batch not found');
    }

    // Soft delete teacher assignments (RLS will enforce Institute Admin requirement)
    const { data: deletedAssignments, error: deleteError } = await supabaseAdmin
      .from('batch_teachers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('batch_id', batchId)
      .in('teacher_id', teacherIds)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .select(`
        *,
        profiles!batch_teachers_teacher_id_fkey(
          id,
          email,
          first_name,
          last_name
        )
      `);

    if (deleteError) {
      throw new Error(`Failed to remove teachers: ${deleteError.message}`);
    }

    if (!deletedAssignments || deletedAssignments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active assignments found to remove',
        data: [],
      });
    }

    return NextResponse.json({
      success: true,
      message: `Removed ${deletedAssignments.length} teacher(s) from batch`,
      data: deletedAssignments,
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

