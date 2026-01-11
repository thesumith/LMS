/**
 * Institute API: Lock Attendance Session
 * 
 * Endpoint for locking an attendance session to prevent further edits.
 * Access: Institute Admin and assigned Teachers (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTenantApiContext } from '@/lib/api/context';
import {
  formatErrorResponse,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '@/lib/errors/api-errors';

/**
 * POST /api/institute/attendance/sessions/[sessionId]/lock
 * 
 * Lock an attendance session
 * 
 * Access: Institute Admin and assigned Teachers
 * Enforced by: RLS policies
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { instituteId, session: authSession } = await requireTenantApiContext(request);
    const userId = authSession.userId;

    const { sessionId } = params;

    if (!sessionId) {
      throw new ValidationError('Session ID is required');
    }

    // Verify session exists
    const { data: attendanceSession, error: sessionError } = await supabaseAdmin
      .from('attendance_sessions')
      .select('id, is_locked, batch_id')
      .eq('id', sessionId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (sessionError || !attendanceSession) {
      throw new NotFoundError('Session not found');
    }

    if (attendanceSession.is_locked) {
      throw new ConflictError('Session is already locked');
    }

    // Lock the session using database function
    const { data: locked, error: lockError } = await (supabaseAdmin as any)
      .rpc('lock_attendance_session', {
        p_session_id: sessionId,
        p_locked_by: userId,
      });

    if (lockError) {
      throw new Error(`Failed to lock session: ${lockError.message}`);
    }

    if (!locked) {
      throw new ConflictError('Session could not be locked. It may already be locked.');
    }

    // Fetch updated session
    const { data: updatedSession, error: fetchError } = await supabaseAdmin
      .from('attendance_sessions')
      .select(`
        *,
        batches(name),
        courses(name, code),
        profiles!attendance_sessions_locked_by_fkey(
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('id', sessionId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch updated session: ${fetchError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Session locked successfully',
      data: updatedSession,
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

