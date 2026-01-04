/**
 * Teacher Dashboard Data
 * 
 * Server-side functions for fetching teacher dashboard analytics.
 * All queries respect RLS and only include batches teacher is assigned to.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';

export interface TeacherDashboard {
  assignedBatchesCount: number;
  totalStudents: number;
  pendingEvaluations: number;
  averageProgressPercentage: number;
  recentSubmissions: Array<{
    id: string;
    assignment_title: string;
    student_name: string;
    submitted_at: string;
    is_late: boolean;
    marks: number | null;
  }>;
  upcomingSessions: Array<{
    id: string;
    session_date: string;
    title: string | null;
    batch_name: string;
    course_name: string;
  }>;
}

/**
 * Get teacher dashboard statistics
 * 
 * @param teacherId - Teacher ID
 * @param instituteId - Institute ID
 * @returns Dashboard statistics
 */
export async function getTeacherDashboard(
  teacherId: string,
  instituteId: string
): Promise<TeacherDashboard> {
  const { data, error } = await supabaseAdmin.rpc('get_teacher_dashboard', {
    p_teacher_id: teacherId,
    p_institute_id: instituteId,
  });

  if (error || !data || data.length === 0) {
    throw new Error(
      `Failed to fetch teacher dashboard: ${error?.message || 'No data returned'}`
    );
  }

  const result = data[0];

  return {
    assignedBatchesCount: Number(result.assigned_batches_count),
    totalStudents: Number(result.total_students),
    pendingEvaluations: Number(result.pending_evaluations),
    averageProgressPercentage: Number(result.average_progress_percentage),
    recentSubmissions: result.recent_submissions || [],
    upcomingSessions: result.upcoming_sessions || [],
  };
}
