/**
 * Certificate Eligibility Evaluation
 * 
 * Server-side functions for evaluating certificate eligibility.
 * Uses database functions to ensure accuracy and prevent client-side manipulation.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';

export interface EligibilityResult {
  isEligible: boolean;
  attendancePercentage: number;
  meetsAttendance: boolean;
  examPassed: boolean;
  assignmentsCompleted: boolean;
  eligibilityDetails: {
    attendance_percentage: number;
    min_attendance_required: number;
    meets_attendance: boolean;
    require_exam_pass: boolean;
    exam_passed: boolean;
    require_assignment_completion: boolean;
    assignments_completed: boolean;
    total_sessions: number;
    present_sessions: number;
  };
}

/**
 * Evaluate certificate eligibility for a student
 * 
 * @param studentId - Student ID
 * @param courseId - Course ID
 * @param batchId - Batch ID
 * @returns Eligibility result with detailed breakdown
 */
export async function evaluateEligibility(
  studentId: string,
  courseId: string,
  batchId: string
): Promise<EligibilityResult> {
  const { data, error } = await supabaseAdmin.rpc('evaluate_certificate_eligibility', {
    p_student_id: studentId,
    p_course_id: courseId,
    p_batch_id: batchId,
  });

  if (error || !data || data.length === 0) {
    throw new Error(
      `Failed to evaluate eligibility: ${error?.message || 'No data returned'}`
    );
  }

  const result = data[0];

  return {
    isEligible: result.is_eligible,
    attendancePercentage: Number(result.attendance_percentage),
    meetsAttendance: result.meets_attendance,
    examPassed: result.exam_passed,
    assignmentsCompleted: result.assignments_completed,
    eligibilityDetails: result.eligibility_details,
  };
}

/**
 * Check if certificate already exists for student/course/batch
 * 
 * @param studentId - Student ID
 * @param courseId - Course ID
 * @param batchId - Batch ID
 * @returns Certificate ID if exists, null otherwise
 */
export async function checkExistingCertificate(
  studentId: string,
  courseId: string,
  batchId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('certificates')
    .select('id')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .eq('batch_id', batchId)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}

