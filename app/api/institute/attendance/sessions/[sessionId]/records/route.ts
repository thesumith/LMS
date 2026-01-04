/**
 * Institute API: Attendance Records Management
 * 
 * Endpoints for marking and managing attendance records.
 * Access: Institute Admin and assigned Teachers (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  formatErrorResponse,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '@/lib/errors/api-errors';

interface MarkAttendanceRequest {
  studentId: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
}

interface BulkMarkAttendanceRequest {
  records: Array<{
    studentId: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    notes?: string;
  }>;
}

/**
 * POST /api/institute/attendance/sessions/[sessionId]/records
 * 
 * Mark attendance for a student or bulk mark for multiple students
 * 
 * Access: Institute Admin and assigned Teachers
 * Can only mark if session is not locked
 * Enforced by: RLS policies
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
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

    const { sessionId } = params;

    if (!sessionId) {
      throw new ValidationError('Session ID is required');
    }

    // Verify session exists and is not locked
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('attendance_sessions')
      .select('id, batch_id, is_locked, session_date')
      .eq('id', sessionId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (sessionError || !session) {
      throw new NotFoundError('Session not found');
    }

    if (session.is_locked) {
      throw new ConflictError('Cannot mark attendance. Session is locked.');
    }

    // Parse request body
    const body = await request.json();

    // Check if bulk or single record
    const isBulk = Array.isArray(body.records);

    if (isBulk) {
      // Bulk mark attendance
      const bulkRequest = body as BulkMarkAttendanceRequest;

      if (!bulkRequest.records || bulkRequest.records.length === 0) {
        throw new ValidationError('At least one attendance record is required');
      }

      // Validate all records
      for (const record of bulkRequest.records) {
        if (!record.studentId?.trim()) {
          throw new ValidationError('Student ID is required for all records');
        }
        if (!['present', 'absent', 'late', 'excused'].includes(record.status)) {
          throw new ValidationError('Invalid status. Must be: present, absent, late, or excused');
        }
      }

      // Get all student IDs
      const studentIds = bulkRequest.records.map((r) => r.studentId);

      // Verify all students are enrolled in batch
      const { data: enrollments, error: enrollmentError } = await supabaseAdmin
        .from('batch_students')
        .select('student_id')
        .eq('batch_id', session.batch_id)
        .in('student_id', studentIds)
        .eq('status', 'active')
        .is('deleted_at', null);

      if (enrollmentError) {
        throw new Error(`Failed to validate enrollments: ${enrollmentError.message}`);
      }

      const enrolledStudentIds = enrollments?.map((e) => e.student_id) || [];
      const invalidStudents = studentIds.filter((id) => !enrolledStudentIds.includes(id));

      if (invalidStudents.length > 0) {
        throw new ValidationError(
          `One or more students are not enrolled in this batch: ${invalidStudents.join(', ')}`
        );
      }

      // Create or update attendance records
      const recordsToInsert = bulkRequest.records.map((record) => ({
        institute_id: instituteId,
        session_id: sessionId,
        batch_id: session.batch_id,
        student_id: record.studentId,
        status: record.status,
        marked_by: userId,
        notes: record.notes?.trim() || null,
        is_automatic: false,
      }));

      const { data: createdRecords, error: insertError } = await supabaseAdmin
        .from('attendance_records')
        .upsert(recordsToInsert, {
          onConflict: 'session_id,student_id,deleted_at',
          ignoreDuplicates: false,
        })
        .select(`
          *,
          profiles!attendance_records_student_id_fkey(
            id,
            email,
            first_name,
            last_name
          )
        `);

      if (insertError) {
        throw new Error(`Failed to mark attendance: ${insertError.message}`);
      }

      return NextResponse.json(
        {
          success: true,
          message: `Marked attendance for ${createdRecords?.length || 0} student(s)`,
          data: createdRecords,
        },
        { status: 201 }
      );
    } else {
      // Single record
      const singleRequest = body as MarkAttendanceRequest;

      if (!singleRequest.studentId?.trim()) {
        throw new ValidationError('Student ID is required');
      }
      if (!['present', 'absent', 'late', 'excused'].includes(singleRequest.status)) {
        throw new ValidationError('Invalid status. Must be: present, absent, late, or excused');
      }

      // Verify student is enrolled in batch
      const { data: enrollment, error: enrollmentError } = await supabaseAdmin
        .from('batch_students')
        .select('student_id')
        .eq('batch_id', session.batch_id)
        .eq('student_id', singleRequest.studentId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .single();

      if (enrollmentError || !enrollment) {
        throw new NotFoundError('Student is not enrolled in this batch');
      }

      // Create or update attendance record (RLS will enforce access control)
      const { data: record, error: insertError } = await supabaseAdmin
        .from('attendance_records')
        .upsert(
          {
            institute_id: instituteId,
            session_id: sessionId,
            batch_id: session.batch_id,
            student_id: singleRequest.studentId,
            status: singleRequest.status,
            marked_by: userId,
            notes: singleRequest.notes?.trim() || null,
            is_automatic: false,
          },
          {
            onConflict: 'session_id,student_id,deleted_at',
            ignoreDuplicates: false,
          }
        )
        .select(`
          *,
          profiles!attendance_records_student_id_fkey(
            id,
            email,
            first_name,
            last_name
          )
        `)
        .single();

      if (insertError) {
        throw new Error(`Failed to mark attendance: ${insertError.message}`);
      }

      return NextResponse.json(
        {
          success: true,
          data: record,
        },
        { status: 201 }
      );
    }
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * GET /api/institute/attendance/sessions/[sessionId]/records
 * 
 * Get all attendance records for a session
 * 
 * Access: Institute Admin, assigned Teachers, enrolled Students (own only)
 * Enforced by: RLS policies
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
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

    const { sessionId } = params;

    if (!sessionId) {
      throw new ValidationError('Session ID is required');
    }

    // Fetch records (RLS will filter automatically based on user role)
    const { data: records, error } = await supabaseAdmin
      .from('attendance_records')
      .select(`
        *,
        profiles!attendance_records_student_id_fkey(
          id,
          email,
          first_name,
          last_name
        ),
        profiles!attendance_records_marked_by_fkey(
          id,
          email,
          first_name,
          last_name
        ) as marked_by_profile,
        attendance_sessions(
          id,
          session_date,
          session_type,
          is_locked,
          title
        )
      `)
      .eq('session_id', sessionId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('marked_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch attendance records: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: records || [],
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

