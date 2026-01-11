/**
 * Student API: View Own Attendance
 * 
 * Endpoint for students to view their own attendance records.
 * Access: Students only (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTenantApiContext } from '@/lib/api/context';
import {
  formatErrorResponse,
  ValidationError,
} from '@/lib/errors/api-errors';

/**
 * GET /api/student/attendance
 * 
 * Get student's own attendance records
 * 
 * Query Parameters:
 * - batchId: Filter by batch
 * - startDate: Filter by start date
 * - endDate: Filter by end date
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query (RLS will filter to student's own records)
    let query = supabaseAdmin
      .from('attendance_records')
      .select(`
        *,
        attendance_sessions(
          id,
          session_date,
          session_type,
          title,
          is_locked,
          batches(
            name,
            courses(name, code)
          ),
          lessons(id, title)
        )
      `)
      .eq('student_id', userId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('marked_at', { ascending: false });

    if (batchId) {
      query = query.eq('batch_id', batchId);
    }

    if (startDate) {
      query = query.gte('attendance_sessions.session_date', startDate);
    }

    if (endDate) {
      query = query.lte('attendance_sessions.session_date', endDate);
    }

    const { data: records, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch attendance: ${error.message}`);
    }

    // Calculate statistics
    const total = records?.length || 0;
    const present = records?.filter((r: any) => r.status === 'present').length || 0;
    const absent = records?.filter((r: any) => r.status === 'absent').length || 0;
    const late = records?.filter((r: any) => r.status === 'late').length || 0;
    const excused = records?.filter((r: any) => r.status === 'excused').length || 0;
    const attendancePercentage = total > 0 ? (present / total) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        records: records || [],
        statistics: {
          total,
          present,
          absent,
          late,
          excused,
          attendancePercentage: Math.round(attendancePercentage * 100) / 100,
        },
      },
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

