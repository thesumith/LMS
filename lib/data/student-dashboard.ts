/**
 * Student Dashboard Data Fetching
 * 
 * Server-side functions for fetching student dashboard data.
 * Uses Supabase client with RLS enforcement.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getUserIdFromHeaders } from '@/lib/middleware/helpers';

export interface StudentBatch {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  course: {
    id: string;
    name: string;
    code: string;
    description: string | null;
  };
  teachers: Array<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  }>;
  enrollment: {
    status: string;
    enrolled_at: string;
  };
  progress: {
    totalLessons: number;
    completedLessons: number;
    progressPercentage: number;
  };
}

export interface StudentDashboardData {
  batches: StudentBatch[];
  summary: {
    totalBatches: number;
    activeBatches: number;
    totalCourses: number;
    averageProgress: number;
  };
}

/**
 * Get student dashboard data (enrolled batches with progress)
 * 
 * Uses RLS to automatically filter to student's enrollments.
 * 
 * @param activeOnly - Include only active batches (default: false)
 * @returns Student dashboard data
 */
export async function getStudentDashboard(
  activeOnly: boolean = false
): Promise<StudentDashboardData> {
  const supabase = await createSupabaseServerClient();
  const userId = await getUserIdFromHeaders();

  if (!userId) {
    throw new Error('Authentication required');
  }

  // Fetch enrolled batches (RLS will filter to student's enrollments)
  let enrollmentsQuery = supabase
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
    .is('deleted_at', null)
    .order('enrolled_at', { ascending: false });

  if (activeOnly) {
    enrollmentsQuery = enrollmentsQuery.eq('status', 'active');
  }

  const { data: enrollments, error: enrollmentsError } = await enrollmentsQuery;

  if (enrollmentsError) {
    throw new Error(`Failed to fetch enrollments: ${enrollmentsError.message}`);
  }

  if (!enrollments || enrollments.length === 0) {
    return {
      batches: [],
      summary: {
        totalBatches: 0,
        activeBatches: 0,
        totalCourses: 0,
        averageProgress: 0,
      },
    };
  }

  // Calculate progress for each batch
  const batchesWithProgress = await Promise.all(
    enrollments.map(async (enrollment: any) => {
      const batch = enrollment.batches;
      const courseId = batch?.courses?.id;
      const batchId = batch?.id;

      if (!courseId || !batchId) {
        return {
          id: batch?.id,
          name: batch?.name,
          start_date: batch?.start_date,
          end_date: batch?.end_date,
          is_active: batch?.is_active,
          course: batch?.courses,
          teachers: [],
          enrollment: {
            status: enrollment.status,
            enrolled_at: enrollment.enrolled_at,
          },
          progress: {
            totalLessons: 0,
            completedLessons: 0,
            progressPercentage: 0,
          },
        };
      }

      // Calculate course progress
      const { data: progressData, error: progressError } = await supabase
        .rpc('calculate_course_progress', {
          p_student_id: userId,
          p_course_id: courseId,
          p_batch_id: batchId,
        });

      const progress = progressData?.[0] || {
        total_lessons: 0,
        completed_lessons: 0,
        progress_percentage: 0,
      };

      // Extract teachers
      const teachers =
        batch?.batch_teachers?.map((bt: any) => bt.profiles).filter(Boolean) || [];

      return {
        id: batch.id,
        name: batch.name,
        start_date: batch.start_date,
        end_date: batch.end_date,
        is_active: batch.is_active,
        course: batch.courses,
        teachers,
        enrollment: {
          status: enrollment.status,
          enrolled_at: enrollment.enrolled_at,
        },
        progress: {
          totalLessons: progress.total_lessons,
          completedLessons: progress.completed_lessons,
          progressPercentage: Number(progress.progress_percentage),
        },
      };
    })
  );

  // Calculate summary
  const totalBatches = batchesWithProgress.length;
  const activeBatches = batchesWithProgress.filter((b) => b.is_active).length;
  const totalCourses = new Set(
    batchesWithProgress.map((b) => b.course.id).filter(Boolean)
  ).size;
  const averageProgress =
    batchesWithProgress.reduce(
      (sum, b) => sum + b.progress.progressPercentage,
      0
    ) / totalBatches || 0;

  return {
    batches: batchesWithProgress,
    summary: {
      totalBatches,
      activeBatches,
      totalCourses,
      averageProgress: Math.round(averageProgress * 100) / 100,
    },
  };
}

/**
 * Get student progress for a specific batch
 * 
 * @param batchId - Batch ID
 * @returns Progress data for the batch
 */
export async function getBatchProgress(batchId: string) {
  const supabase = await createSupabaseServerClient();
  const userId = await getUserIdFromHeaders();

  if (!userId) {
    throw new Error('Authentication required');
  }

  // Fetch progress (RLS will filter to student's own progress)
  const { data: progress, error } = await supabase
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
      batches(id, name),
      courses(id, name, code)
    `)
    .eq('student_id', userId)
    .eq('batch_id', batchId)
    .is('deleted_at', null)
    .order('last_viewed_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch progress: ${error.message}`);
  }

  return progress || [];
}

