/**
 * Teacher Dashboard Data Fetching
 * 
 * Server-side functions for fetching teacher dashboard data.
 * Uses Supabase client with RLS enforcement.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getUserIdFromHeaders } from '@/lib/middleware/helpers';

export interface TeacherBatch {
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
  student_count: number;
  active_student_count: number;
}

export interface TeacherDashboardData {
  batches: TeacherBatch[];
  summary: {
    totalBatches: number;
    activeBatches: number;
    totalStudents: number;
    activeStudents: number;
  };
}

/**
 * Get teacher dashboard data (assigned batches with student counts)
 * 
 * Uses RLS to automatically filter to batches where teacher is assigned.
 * 
 * @param includeInactive - Include inactive batches (default: false)
 * @returns Teacher dashboard data
 */
export async function getTeacherDashboard(
  includeInactive: boolean = false
): Promise<TeacherDashboardData> {
  const supabase = await createSupabaseServerClient();
  const userId = await getUserIdFromHeaders();

  if (!userId) {
    throw new Error('Authentication required');
  }

  // Fetch assigned batches
  // RLS policy ensures teacher only sees batches they are assigned to
  let batchesQuery = supabase
    .from('batches')
    .select(`
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
      batch_teachers!inner(
        teacher_id
      )
    `)
    .is('deleted_at', null)
    .order('start_date', { ascending: false });

  if (!includeInactive) {
    batchesQuery = batchesQuery.eq('is_active', true);
  }

  const { data: batches, error: batchesError } = await batchesQuery;

  if (batchesError) {
    throw new Error(`Failed to fetch batches: ${batchesError.message}`);
  }

  if (!batches || batches.length === 0) {
    return {
      batches: [],
      summary: {
        totalBatches: 0,
        activeBatches: 0,
        totalStudents: 0,
        activeStudents: 0,
      },
    };
  }

  // Get student counts for each batch
  const batchIds = batches.map((b) => b.id);

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('batch_students')
    .select('batch_id, status')
    .in('batch_id', batchIds)
    .is('deleted_at', null);

  if (enrollmentsError) {
    throw new Error(`Failed to fetch enrollments: ${enrollmentsError.message}`);
  }

  // Calculate student counts per batch
  const studentCounts = new Map<string, { total: number; active: number }>();

  (enrollments || []).forEach((enrollment) => {
    const batchId = enrollment.batch_id;
    const current = studentCounts.get(batchId) || { total: 0, active: 0 };
    current.total += 1;
    if (enrollment.status === 'active') {
      current.active += 1;
    }
    studentCounts.set(batchId, current);
  });

  // Combine batch data with student counts
  const batchesWithCounts: TeacherBatch[] = batches.map((batch: any) => {
    const counts = studentCounts.get(batch.id) || { total: 0, active: 0 };
    return {
      id: batch.id,
      name: batch.name,
      start_date: batch.start_date,
      end_date: batch.end_date,
      is_active: batch.is_active,
      course: Array.isArray(batch.courses) ? batch.courses[0] : batch.courses,
      student_count: counts.total,
      active_student_count: counts.active,
    };
  });

  // Calculate summary
  const totalBatches = batchesWithCounts.length;
  const activeBatches = batchesWithCounts.filter((b) => b.is_active).length;
  const totalStudents = Array.from(studentCounts.values()).reduce(
    (sum, counts) => sum + counts.total,
    0
  );
  const activeStudents = Array.from(studentCounts.values()).reduce(
    (sum, counts) => sum + counts.active,
    0
  );

  return {
    batches: batchesWithCounts,
    summary: {
      totalBatches,
      activeBatches,
      totalStudents,
      activeStudents,
    },
  };
}

/**
 * Get students for a specific batch
 * 
 * Uses RLS to ensure teacher is assigned to the batch.
 * 
 * @param batchId - Batch ID
 * @param status - Optional status filter
 * @returns Students enrolled in the batch
 */
export async function getBatchStudents(
  batchId: string,
  status?: 'active' | 'completed' | 'dropped'
) {
  const supabase = await createSupabaseServerClient();

  // Verify teacher is assigned to batch (RLS will enforce this)
  const { data: assignment, error: assignmentError } = await supabase
    .from('batch_teachers')
    .select('batch_id')
    .eq('batch_id', batchId)
    .is('deleted_at', null)
    .single();

  if (assignmentError || !assignment) {
    throw new Error('You are not assigned to this batch');
  }

  // Fetch students (RLS will enforce teacher can only see their batches)
  let studentsQuery = supabase
    .from('batch_students')
    .select(`
      id,
      student_id,
      status,
      enrolled_at,
      completed_at,
      dropped_at,
      profiles(
        id,
        email,
        first_name,
        last_name
      )
    `)
    .eq('batch_id', batchId)
    .is('deleted_at', null)
    .order('enrolled_at', { ascending: false });

  if (status) {
    studentsQuery = studentsQuery.eq('status', status);
  }

  const { data: students, error: studentsError } = await studentsQuery;

  if (studentsError) {
    throw new Error(`Failed to fetch students: ${studentsError.message}`);
  }

  return students || [];
}

/**
 * Get batch details with course information
 * 
 * Uses RLS to ensure teacher is assigned to the batch.
 * 
 * @param batchId - Batch ID
 * @returns Batch details with course information
 */
export async function getBatchDetails(batchId: string) {
  const supabase = await createSupabaseServerClient();

  // Fetch batch (RLS will enforce teacher can only see assigned batches)
  const { data: batch, error: batchError } = await supabase
    .from('batches')
    .select(`
      *,
      courses(
        id,
        name,
        code,
        description
      ),
      batch_teachers!inner(
        teacher_id
      )
    `)
    .eq('id', batchId)
    .is('deleted_at', null)
    .single();

  if (batchError || !batch) {
    throw new Error('Batch not found or you are not assigned to this batch');
  }

  return batch;
}

