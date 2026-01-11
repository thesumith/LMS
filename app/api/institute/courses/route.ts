/**
 * Institute API: Courses Management
 * 
 * Endpoints for creating and managing courses within an institute.
 * Only accessible to Institute Admin (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTenantApiContext } from '@/lib/api/context';
import {
  formatErrorResponse,
  ValidationError,
  ConflictError,
} from '@/lib/errors/api-errors';

interface CreateCourseRequest {
  name: string;
  code: string;
  description?: string;
  isActive?: boolean;
}

/**
 * POST /api/institute/courses
 * 
 * Create a new course
 * 
 * Requires: Institute Admin role
 * Enforced by: RLS policies
 */
export async function POST(request: NextRequest) {
  try {
    const { instituteId } = await requireTenantApiContext(request);

    // Parse request body
    const body: CreateCourseRequest = await request.json();
    const { name, code, description, isActive = true } = body;

    // Validation
    if (!name?.trim()) {
      throw new ValidationError('Course name is required');
    }
    if (!code?.trim()) {
      throw new ValidationError('Course code is required');
    }

    // Normalize course code (uppercase, no spaces)
    const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, '');

    // Check if course code already exists in this institute
    const { data: existingCourse } = await supabaseAdmin
      .from('courses')
      .select('id')
      .eq('institute_id', instituteId)
      .eq('code', normalizedCode)
      .is('deleted_at', null)
      .single();

    if (existingCourse) {
      throw new ConflictError('Course code already exists in this institute');
    }

    // Create course (RLS will enforce Institute Admin requirement)
    const { data: course, error } = await supabaseAdmin
      .from('courses')
      .insert({
        institute_id: instituteId,
        name: name.trim(),
        code: normalizedCode,
        description: description?.trim() || null,
        is_active: isActive,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create course: ${error.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: course,
      },
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * GET /api/institute/courses
 * 
 * List all courses in the institute
 * 
 * Requires: Institute Admin role (enforced by RLS)
 */
export async function GET(request: NextRequest) {
  try {
    const { instituteId } = await requireTenantApiContext(request);

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    // Build query (RLS will filter by institute_id automatically)
    let query = supabaseAdmin
      .from('courses')
      .select('*')
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: courses, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch courses: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: courses || [],
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

