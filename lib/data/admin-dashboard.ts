/**
 * Institute Admin Dashboard Data
 * 
 * Server-side functions for fetching admin dashboard analytics.
 * All queries respect RLS and perform aggregation at database level.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';

export interface InstituteAdminDashboard {
  totalStudents: number;
  totalTeachers: number;
  activeCourses: number;
  activeBatches: number;
  totalCertificates: number;
  averageAttendancePercentage: number;
  completionRate: number;
  recentCertificates: Array<{
    id: string;
    certificate_number: string;
    student_name: string;
    course_name: string;
    issued_at: string;
  }>;
}

/**
 * Get institute admin dashboard statistics
 * 
 * @param instituteId - Institute ID
 * @returns Dashboard statistics
 */
export async function getInstituteAdminDashboard(
  instituteId: string
): Promise<InstituteAdminDashboard> {
  const { data, error } = await supabaseAdmin.rpc('get_institute_admin_dashboard', {
    p_institute_id: instituteId,
  });

  if (error || !data || data.length === 0) {
    throw new Error(
      `Failed to fetch admin dashboard: ${error?.message || 'No data returned'}`
    );
  }

  const result = data[0];

  return {
    totalStudents: Number(result.total_students),
    totalTeachers: Number(result.total_teachers),
    activeCourses: Number(result.active_courses),
    activeBatches: Number(result.active_batches),
    totalCertificates: Number(result.total_certificates),
    averageAttendancePercentage: Number(result.average_attendance_percentage),
    completionRate: Number(result.completion_rate),
    recentCertificates: result.recent_certificates || [],
  };
}

