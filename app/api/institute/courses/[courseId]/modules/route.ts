/**
 * Institute API: Course Modules Management
 * 
 * Endpoints for creating and managing modules within a course.
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

interface CreateModuleRequest {
  name: string;
  description?: string;
  sequence: number;
  isActive?: boolean;
}

/**
 * POST /api/institute/courses/[courseId]/modules
 * 
 * Create a new module in a course
 * 
 * Access: Institute Admin and assigned Teachers
 * Enforced by: RLS policies
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const { instituteId } = await requireTenantApiContext(request);

    const { courseId } = params;

    if (!courseId) {
      throw new ValidationError('Course ID is required');
    }

    // Parse request body
    const body: CreateModuleRequest = await request.json();
    const { name, description, sequence, isActive = true } = body;

    // Validation
    if (!name?.trim()) {
      throw new ValidationError('Module name is required');
    }
    if (!sequence || sequence < 1) {
      throw new ValidationError('Sequence must be a positive integer');
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

    // Check if sequence already exists for this course
    const { data: existingModule } = await supabaseAdmin
      .from('modules')
      .select('id')
      .eq('course_id', courseId)
      .eq('sequence', sequence)
      .is('deleted_at', null)
      .single();

    if (existingModule) {
      throw new ValidationError(
        `Module with sequence ${sequence} already exists in this course`
      );
    }

    // Create module (RLS will enforce access control)
    const { data: module, error: moduleError } = await supabaseAdmin
      .from('modules')
      .insert({
        institute_id: instituteId,
        course_id: courseId,
        name: name.trim(),
        description: description?.trim() || null,
        sequence,
        is_active: isActive,
      })
      .select()
      .single();

    if (moduleError) {
      throw new Error(`Failed to create module: ${moduleError.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: module,
      },
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * GET /api/institute/courses/[courseId]/modules
 * 
 * List all modules in a course
 * 
 * Access: Institute Admin, assigned Teachers, enrolled Students
 * Enforced by: RLS policies
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const { instituteId } = await requireTenantApiContext(request);

    const { courseId } = params;

    if (!courseId) {
      throw new ValidationError('Course ID is required');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    // Build query (RLS will filter automatically based on user role)
    let query = supabaseAdmin
      .from('modules')
      .select(`
        *,
        courses(id, name, code)
      `)
      .eq('course_id', courseId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('sequence', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: modules, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch modules: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: modules || [],
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

