/**
 * Student API: Lesson Progress Tracking
 * 
 * Endpoints for tracking student progress through lessons.
 * Access: Students only (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTenantApiContext } from '@/lib/api/context';
import {
  formatErrorResponse,
  ValidationError,
  NotFoundError,
} from '@/lib/errors/api-errors';

interface UpdateProgressRequest {
  lessonId: string;
  batchId: string;
  progressPercentage?: number;
  markComplete?: boolean;
}

/**
 * POST /api/student/progress
 * 
 * Create or update lesson progress
 * 
 * Access: Students only
 * Enforced by: RLS policies
 */
export async function POST(request: NextRequest) {
  try {
    const { instituteId, session } = await requireTenantApiContext(request);
    const userId = session.userId;

    // Parse request body
    const body: UpdateProgressRequest = await request.json();
    const { lessonId, batchId, progressPercentage, markComplete } = body;

    // Validation
    if (!lessonId?.trim()) {
      throw new ValidationError('Lesson ID is required');
    }
    if (!batchId?.trim()) {
      throw new ValidationError('Batch ID is required');
    }

    // Verify student is enrolled in batch
    const { data: enrollment, error: enrollmentError } = await supabaseAdmin
      .from('batch_students')
      .select('id, status, batches(course_id)')
      .eq('batch_id', batchId)
      .eq('student_id', userId)
      .eq('institute_id', instituteId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single();

    if (enrollmentError || !enrollment) {
      throw new NotFoundError('You are not enrolled in this batch');
    }

    const courseId = (enrollment.batches as any)?.course_id;
    if (!courseId) {
      throw new NotFoundError('Course not found for this batch');
    }

    // Verify lesson exists and belongs to the course
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('lessons')
      .select(`
        id,
        title,
        modules(course_id)
      `)
      .eq('id', lessonId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (lessonError || !lesson) {
      throw new NotFoundError('Lesson not found');
    }

    const lessonCourseId = (lesson.modules as any)?.course_id;
    if (lessonCourseId !== courseId) {
      throw new ValidationError('Lesson does not belong to this course');
    }

    // Check if progress record exists
    const { data: existingProgress } = await supabaseAdmin
      .from('lesson_progress')
      .select('id, completed_at, progress_percentage')
      .eq('student_id', userId)
      .eq('lesson_id', lessonId)
      .eq('batch_id', batchId)
      .is('deleted_at', null)
      .single();

    let progressData: any;

    if (existingProgress) {
      // Update existing progress
      if (existingProgress.completed_at) {
        throw new ValidationError(
          'Cannot update completed progress. Progress is immutable once marked complete.'
        );
      }

      const updateData: any = {
        last_viewed_at: new Date().toISOString(),
      };

      if (markComplete) {
        updateData.completed_at = new Date().toISOString();
        updateData.progress_percentage = 100;
      } else if (progressPercentage !== undefined) {
        if (progressPercentage < 0 || progressPercentage > 100) {
          throw new ValidationError('Progress percentage must be between 0 and 100');
        }
        updateData.progress_percentage = progressPercentage;
      }

      const { data: updatedProgress, error: updateError } = await supabaseAdmin
        .from('lesson_progress')
        .update(updateData)
        .eq('id', existingProgress.id)
        .select(`
          *,
          lessons(title, content_type),
          batches(name),
          courses(name, code)
        `)
        .single();

      if (updateError) {
        throw new Error(`Failed to update progress: ${updateError.message}`);
      }

      progressData = updatedProgress;
    } else {
      // Create new progress record
      const insertData: any = {
        institute_id: instituteId,
        student_id: userId,
        lesson_id: lessonId,
        batch_id: batchId,
        course_id: courseId,
        started_at: new Date().toISOString(),
        last_viewed_at: new Date().toISOString(),
      };

      if (markComplete) {
        insertData.completed_at = new Date().toISOString();
        insertData.progress_percentage = 100;
      } else {
        insertData.progress_percentage = progressPercentage || 0;
      }

      const { data: newProgress, error: insertError } = await supabaseAdmin
        .from('lesson_progress')
        .insert(insertData)
        .select(`
          *,
          lessons(title, content_type),
          batches(name),
          courses(name, code)
        `)
        .single();

      if (insertError) {
        throw new Error(`Failed to create progress: ${insertError.message}`);
      }

      progressData = newProgress;
    }

    return NextResponse.json({
      success: true,
      data: progressData,
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * GET /api/student/progress
 * 
 * Get student progress for batches or courses
 * 
 * Query Parameters:
 * - batchId: Filter by batch
 * - courseId: Filter by course
 * - lessonId: Filter by lesson
 * 
 * Access: Students only
 * Enforced by: RLS policies
 */
export async function GET(request: NextRequest) {
  try {
    const { instituteId, session } = await requireTenantApiContext(request);
    const userId = session.userId;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');
    const courseId = searchParams.get('courseId');
    const lessonId = searchParams.get('lessonId');
    const includeCompleted = searchParams.get('includeCompleted') !== 'false';

    // Build query (RLS will filter to student's own progress)
    let query = supabaseAdmin
      .from('lesson_progress')
      .select(`
        *,
        lessons(
          id,
          title,
          content_type,
          sequence,
          modules(id, name, sequence)
        ),
        batches(id, name, start_date, end_date),
        courses(id, name, code)
      `)
      .eq('student_id', userId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('last_viewed_at', { ascending: false });

    if (batchId) {
      query = query.eq('batch_id', batchId);
    }

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    if (lessonId) {
      query = query.eq('lesson_id', lessonId);
    }

    if (!includeCompleted) {
      query = query.is('completed_at', null);
    }

    const { data: progress, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch progress: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: progress || [],
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

