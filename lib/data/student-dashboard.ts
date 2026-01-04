/**
 * Student Dashboard Data
 * 
 * Server-side functions for fetching student dashboard analytics.
 * All queries respect RLS and only include student's own data.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';

export interface StudentDashboard {
  enrolledCoursesCount: number;
  totalProgressPercentage: number;
  certificatesCount: number;
  upcomingExams: Array<{
    id: string;
    title: string;
    exam_date: string;
    batch_name: string;
    course_name: string;
  }>;
  recentAssignments: Array<{
    id: string;
    title: string;
    due_date: string;
    submission_deadline: string;
    batch_name: string;
    course_name: string;
    submitted: boolean;
  }>;
  attendanceSummary: {
    total_sessions: number;
    present_count: number;
    absent_count: number;
    late_count: number;
    attendance_percentage: number;
  };
}

/**
 * Get student dashboard statistics
 * 
 * @param studentId - Student ID
 * @param instituteId - Institute ID
 * @returns Dashboard statistics
 */
export async function getStudentDashboard(
  studentId: string,
  instituteId: string
): Promise<StudentDashboard> {
  const { data, error } = await supabaseAdmin.rpc('get_student_dashboard', {
    p_student_id: studentId,
    p_institute_id: instituteId,
  });

  if (error || !data || data.length === 0) {
    throw new Error(
      `Failed to fetch student dashboard: ${error?.message || 'No data returned'}`
    );
  }

  const result = data[0];

  return {
    enrolledCoursesCount: Number(result.enrolled_courses_count),
    totalProgressPercentage: Number(result.total_progress_percentage),
    certificatesCount: Number(result.certificates_count),
    upcomingExams: result.upcoming_exams || [],
    recentAssignments: result.recent_assignments || [],
    attendanceSummary: result.attendance_summary || {
      total_sessions: 0,
      present_count: 0,
      absent_count: 0,
      late_count: 0,
      attendance_percentage: 0,
    },
  };
}
