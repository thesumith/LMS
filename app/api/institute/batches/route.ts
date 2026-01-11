/**
 * Institute API: Batches Management
 * 
 * Endpoints for creating and managing batches within an institute.
 * Only accessible to Institute Admin (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTenantApiContext } from '@/lib/api/context';
import {
  formatErrorResponse,
  ValidationError,
  NotFoundError,
} from '@/lib/errors/api-errors';

interface CreateBatchRequest {
  courseId: string;
  name: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  teacherIds?: string[]; // Optional: assign teachers during creation
  isActive?: boolean;
}

/**
 * POST /api/institute/batches
 * 
 * Create a new batch
 * 
 * Requires: Institute Admin role
 * Enforced by: RLS policies
 */
export async function POST(request: NextRequest) {
  try {
    const { instituteId } = await requireTenantApiContext(request);

    // Parse request body
    const body: CreateBatchRequest = await request.json();
    const {
      courseId,
      name,
      startDate,
      endDate,
      teacherIds = [],
      isActive = true,
    } = body;

    // Validation
    if (!courseId?.trim()) {
      throw new ValidationError('Course ID is required');
    }
    if (!name?.trim()) {
      throw new ValidationError('Batch name is required');
    }
    if (!startDate) {
      throw new ValidationError('Start date is required');
    }
    if (!endDate) {
      throw new ValidationError('End date is required');
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ValidationError('Invalid date format');
    }

    if (end < start) {
      throw new ValidationError('End date must be after start date');
    }

    // Verify course exists and belongs to institute
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, name')
      .eq('id', courseId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (courseError || !course) {
      throw new NotFoundError('Course not found');
    }

    // Create batch (RLS will enforce Institute Admin requirement)
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .insert({
        institute_id: instituteId,
        course_id: courseId,
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        is_active: isActive,
      })
      .select()
      .single();

    if (batchError) {
      throw new Error(`Failed to create batch: ${batchError.message}`);
    }

    // Assign teachers if provided
    if (teacherIds.length > 0) {
      // Verify all teachers belong to institute and have TEACHER role
      const { data: teachers, error: teachersError } = await supabaseAdmin
        .from('profiles')
        .select(`
          id,
          user_roles!inner(role_name)
        `)
        .eq('institute_id', instituteId)
        .in('id', teacherIds)
        .is('deleted_at', null)
        .eq('user_roles.role_name', 'TEACHER')
        .eq('user_roles.deleted_at', null);

      if (teachersError) {
        // Rollback: delete batch
        await supabaseAdmin.from('batches').delete().eq('id', batch.id);
        throw new Error(`Failed to validate teachers: ${teachersError.message}`);
      }

      if (!teachers || teachers.length !== teacherIds.length) {
        // Rollback: delete batch
        await supabaseAdmin.from('batches').delete().eq('id', batch.id);
        throw new ValidationError('One or more teachers are invalid or not found');
      }

      // Assign teachers
      const teacherAssignments = teacherIds.map((teacherId) => ({
        institute_id: instituteId,
        batch_id: batch.id,
        teacher_id: teacherId,
      }));

      const { error: assignmentError } = await supabaseAdmin
        .from('batch_teachers')
        .insert(teacherAssignments);

      if (assignmentError) {
        // Rollback: delete batch
        await supabaseAdmin.from('batches').delete().eq('id', batch.id);
        throw new Error(`Failed to assign teachers: ${assignmentError.message}`);
      }
    }

    // Fetch batch with course info
    const { data: batchWithCourse, error: fetchError } = await supabaseAdmin
      .from('batches')
      .select(`
        *,
        courses(name, code)
      `)
      .eq('id', batch.id)
      .single();

    if (fetchError) {
      // Return batch without course info if fetch fails
      return NextResponse.json(
        {
          success: true,
          data: batch,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: batchWithCourse,
      },
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * GET /api/institute/batches
 * 
 * List batches in the institute
 * 
 * Access:
 * - Institute Admin: All batches
 * - Teacher: Only assigned batches
 * - Student: Only enrolled batches
 * 
 * Enforced by: RLS policies
 */
export async function GET(request: NextRequest) {
  try {
    const { instituteId } = await requireTenantApiContext(request);

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const activeOnly = searchParams.get('active') === 'true';

    // Build query (RLS will filter automatically based on user role)
    let query = supabaseAdmin
      .from('batches')
      .select(`
        *,
        courses(name, code),
        batch_teachers(
          teacher_id,
          profiles!batch_teachers_teacher_id_fkey(id, email, first_name, last_name)
        )
      `)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('start_date', { ascending: false });

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: batches, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch batches: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: batches || [],
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

