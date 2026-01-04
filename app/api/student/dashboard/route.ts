/**
 * Student API: Dashboard
 * 
 * Endpoint for student dashboard data including enrolled batches and progress.
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
 * GET /api/student/dashboard
 * 
 * Get student dashboard data:
 * - Enrolled batches
 * - Course information
 * - Assigned teachers
 * - Progress percentage per course
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
    const activeOnly = searchParams.get('active') === 'true';

    // Fetch enrolled batches (RLS will filter to student's enrollments)
    let batchesQuery = supabaseAdmin
      .from('batch_students')
      .select(`
        id,
        status,
        enrolled_at,
        batches(
          id,
          name,
          start_date,
          end_date,
          is_active,
          courses(
            id,
            name,
            code,
            description
          ),
          batch_teachers(
            profiles!batch_teachers_teacher_id_fkey(
              id,
              email,
              first_name,
              last_name
            )
          )
        )
      `)
      .eq('student_id', userId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('enrolled_at', { ascending: false });

    if (activeOnly) {
      batchesQuery = batchesQuery.eq('status', 'active');
    }

    const { data: enrollments, error: enrollmentsError } = await batchesQuery;

    if (enrollmentsError) {
      throw new Error(`Failed to fetch enrollments: ${enrollmentsError.message}`);
    }

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          batches: [],
          summary: {
            totalBatches: 0,
            activeBatches: 0,
            totalCourses: 0,
          },
        },
      });
    }

    // Calculate progress for each batch/course
    const batchesWithProgress = await Promise.all(
      enrollments.map(async (enrollment: any) => {
        const batch = enrollment.batches;
        const courseId = batch?.courses?.id;
        const batchId = batch?.id;

        if (!courseId || !batchId) {
          return {
            ...enrollment,
            progress: {
              totalLessons: 0,
              completedLessons: 0,
              progressPercentage: 0,
            },
          };
        }

        // Calculate course progress using database function
        const { data: progressData, error: progressError } = await supabaseAdmin
          .rpc('calculate_course_progress', {
            p_student_id: userId,
            p_course_id: courseId,
            p_batch_id: batchId,
          });

        if (progressError || !progressData || progressData.length === 0) {
          return {
            ...enrollment,
            progress: {
              totalLessons: 0,
              completedLessons: 0,
              progressPercentage: 0,
            },
          };
        }

        const progress = progressData[0];

        return {
          ...enrollment,
          progress: {
            totalLessons: progress.total_lessons,
            completedLessons: progress.completed_lessons,
            progressPercentage: Number(progress.progress_percentage),
          },
        };
      })
    );

    // Calculate summary statistics
    const totalBatches = batchesWithProgress.length;
    const activeBatches = batchesWithProgress.filter(
      (b: any) => b.status === 'active'
    ).length;
    const totalCourses = new Set(
      batchesWithProgress.map((b: any) => b.batches?.courses?.id).filter(Boolean)
    ).size;
    const averageProgress =
      batchesWithProgress.reduce(
        (sum: number, b: any) => sum + b.progress.progressPercentage,
        0
      ) / totalBatches || 0;

    return NextResponse.json({
      success: true,
      data: {
        batches: batchesWithProgress,
        summary: {
          totalBatches,
          activeBatches,
          totalCourses,
          averageProgress: Math.round(averageProgress * 100) / 100,
        },
      },
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

