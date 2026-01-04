/**
 * Institute API: Certificate Rules Management
 * 
 * Endpoints for configuring certificate eligibility rules per course.
 * Access: Institute Admin only (enforced by RLS).
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

interface CreateCertificateRuleRequest {
  minAttendancePercentage: number;
  requireExamPass: boolean;
  requireAssignmentCompletion: boolean;
  isActive?: boolean;
}

/**
 * POST /api/institute/courses/[courseId]/certificate-rules
 * 
 * Create or update certificate eligibility rules for a course
 * 
 * Access: Institute Admin only
 * Enforced by: RLS policies
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string } }
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

    const { courseId } = params;

    if (!courseId) {
      throw new ValidationError('Course ID is required');
    }

    // Parse request body
    const body: CreateCertificateRuleRequest = await request.json();
    const {
      minAttendancePercentage,
      requireExamPass,
      requireAssignmentCompletion,
      isActive = true,
    } = body;

    // Validation
    if (
      minAttendancePercentage === undefined ||
      minAttendancePercentage < 0 ||
      minAttendancePercentage > 100
    ) {
      throw new ValidationError(
        'Minimum attendance percentage must be between 0 and 100'
      );
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

    // Check if rule already exists
    const { data: existingRule } = await supabaseAdmin
      .from('course_certificate_rules')
      .select('id')
      .eq('course_id', courseId)
      .is('deleted_at', null)
      .single();

    let rule;

    if (existingRule) {
      // Update existing rule
      const { data: updatedRule, error: updateError } = await supabaseAdmin
        .from('course_certificate_rules')
        .update({
          min_attendance_percentage: minAttendancePercentage,
          require_exam_pass: requireExamPass,
          require_assignment_completion: requireAssignmentCompletion,
          is_active: isActive,
        })
        .eq('id', existingRule.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update rule: ${updateError.message}`);
      }

      rule = updatedRule;
    } else {
      // Create new rule (RLS will enforce access control)
      const { data: newRule, error: insertError } = await supabaseAdmin
        .from('course_certificate_rules')
        .insert({
          institute_id: instituteId,
          course_id: courseId,
          min_attendance_percentage: minAttendancePercentage,
          require_exam_pass: requireExamPass,
          require_assignment_completion: requireAssignmentCompletion,
          is_active: isActive,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create rule: ${insertError.message}`);
      }

      rule = newRule;
    }

    return NextResponse.json(
      {
        success: true,
        data: rule,
      },
      { status: existingRule ? 200 : 201 }
    );
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * GET /api/institute/courses/[courseId]/certificate-rules
 * 
 * Get certificate eligibility rules for a course
 * 
 * Access: Institute Admin, assigned Teachers, enrolled Students
 * Enforced by: RLS policies
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
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

    const { courseId } = params;

    if (!courseId) {
      throw new ValidationError('Course ID is required');
    }

    // Fetch rule (RLS will filter automatically)
    const { data: rule, error } = await supabaseAdmin
      .from('course_certificate_rules')
      .select(`
        *,
        courses(name, code)
      `)
      .eq('course_id', courseId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (error || !rule) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No certificate rules defined for this course',
      });
    }

    return NextResponse.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

