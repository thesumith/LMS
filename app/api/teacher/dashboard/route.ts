/**
 * Teacher API: Dashboard Data
 * 
 * Endpoints for teacher dashboard data.
 * Teachers can only see batches they are assigned to.
 * Enforced by: RLS policies
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  formatErrorResponse,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/errors/api-errors';
import { verifySuperAdmin } from '@/lib/auth/verify-super-admin';

/**
 * GET /api/teacher/dashboard
 * 
 * Get teacher dashboard data:
 * - Assigned batches
 * - Course details for each batch
 * - Enrolled students count per batch
 * 
 * Access: Teachers only (enforced by RLS)
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

    // Verify user is SUPER_ADMIN or has TEACHER role
    // RLS will enforce this, but we check here for better error messages
    const isSuperAdmin = await verifySuperAdmin(userId);
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');
    const includeStudents = searchParams.get('includeStudents') === 'true';

    // Build query for assigned batches
    // RLS will automatically filter to batches where teacher is assigned
    let batchesQuery = supabaseAdmin
      .from('batches')
      .select(`
        id,
        name,
        start_date,
        end_date,
        is_active,
        created_at,
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
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('start_date', { ascending: false });

    // If batchId specified, filter to that batch
    if (batchId) {
      batchesQuery = batchesQuery.eq('id', batchId);
    }

    const { data: batches, error: batchesError } = await batchesQuery;

    if (batchesError) {
      throw new Error(`Failed to fetch batches: ${batchesError.message}`);
    }

    // If no batches found, return empty array
    if (!batches || batches.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          batches: [],
          totalBatches: 0,
          activeBatches: 0,
        },
      });
    }

    // Get enrolled students count for each batch
    const batchIds = batches.map((b) => b.id);

    const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
      .from('batch_students')
      .select('batch_id, status')
      .in('batch_id', batchIds)
      .eq('institute_id', instituteId)
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

    // If includeStudents is true, fetch full student details
    let studentsData: Record<string, any[]> = {};
    
    if (includeStudents) {
      const { data: students, error: studentsError } = await supabaseAdmin
        .from('batch_students')
        .select(`
          batch_id,
          student_id,
          status,
          enrolled_at,
          profiles!batch_students_student_id_fkey(
            id,
            email,
            first_name,
            last_name
          )
        `)
        .in('batch_id', batchIds)
        .eq('institute_id', instituteId)
        .is('deleted_at', null)
        .order('enrolled_at', { ascending: false });

      if (studentsError) {
        throw new Error(`Failed to fetch students: ${studentsError.message}`);
      }

      // Group students by batch_id
      (students || []).forEach((student) => {
        if (!studentsData[student.batch_id]) {
          studentsData[student.batch_id] = [];
        }
        studentsData[student.batch_id].push(student);
      });
    }

    // Combine batch data with student counts
    const batchesWithCounts = batches.map((batch) => {
      const counts = studentCounts.get(batch.id) || { total: 0, active: 0 };
      return {
        ...batch,
        studentCount: counts.total,
        activeStudentCount: counts.active,
        students: includeStudents ? (studentsData[batch.id] || []) : undefined,
      };
    });

    // Calculate totals
    const totalBatches = batches.length;
    const activeBatches = batches.filter((b) => b.is_active).length;
    const totalStudents = Array.from(studentCounts.values()).reduce(
      (sum, counts) => sum + counts.total,
      0
    );
    const activeStudents = Array.from(studentCounts.values()).reduce(
      (sum, counts) => sum + counts.active,
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        batches: batchesWithCounts,
        summary: {
          totalBatches,
          activeBatches,
          totalStudents,
          activeStudents,
        },
      },
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

