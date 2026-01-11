/**
 * Institute API: Attendance Sessions Management
 * 
 * Endpoints for creating and managing attendance sessions.
 * Access: Institute Admin and assigned Teachers (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTenantApiContext } from '@/lib/api/context';
import {
  formatErrorResponse,
  ValidationError,
  NotFoundError,
} from '@/lib/errors/api-errors';

interface CreateSessionRequest {
  sessionDate: string; // ISO date string
  title?: string;
  description?: string;
}

/**
 * POST /api/institute/batches/[batchId]/attendance/sessions
 * 
 * Create a new attendance session
 * 
 * Access: Institute Admin and assigned Teachers
 * Enforced by: RLS policies
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { instituteId, session: authSession } = await requireTenantApiContext(request);
    const userId = authSession.userId;

    const { batchId } = params;

    if (!batchId) {
      throw new ValidationError('Batch ID is required');
    }

    // Parse request body
    const body: CreateSessionRequest = await request.json();
    const { sessionDate, title, description } = body;

    // Validation
    if (!sessionDate) {
      throw new ValidationError('Session date is required');
    }

    const sessionDateObj = new Date(sessionDate);
    if (isNaN(sessionDateObj.getTime())) {
      throw new ValidationError('Invalid date format');
    }

    // Verify batch exists and belongs to institute
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('id, name, course_id')
      .eq('id', batchId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (batchError || !batch) {
      throw new NotFoundError('Batch not found');
    }

    // Check if session already exists for this date
    const { data: existingSession } = await supabaseAdmin
      .from('attendance_sessions')
      .select('id')
      .eq('batch_id', batchId)
      .eq('session_date', sessionDate.split('T')[0]) // Extract date part
      .eq('session_type', 'manual')
      .is('deleted_at', null)
      .single();

    if (existingSession) {
      throw new ValidationError(
        'A manual attendance session already exists for this date'
      );
    }

    // Create session (RLS will enforce access control)
    const { data: createdSession, error: sessionError } = await supabaseAdmin
      .from('attendance_sessions')
      .insert({
        institute_id: instituteId,
        batch_id: batchId,
        session_date: sessionDate.split('T')[0], // Store as DATE
        session_type: 'manual',
        title: title?.trim() || null,
        description: description?.trim() || null,
        is_locked: false,
        created_by: userId,
      })
      .select(`
        *,
        batches(name),
        courses(name, code)
      `)
      .single();

    if (sessionError) {
      throw new Error(`Failed to create session: ${sessionError.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: createdSession,
      },
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * GET /api/institute/batches/[batchId]/attendance/sessions
 * 
 * List all attendance sessions for a batch
 * 
 * Access: Institute Admin, assigned Teachers, enrolled Students
 * Enforced by: RLS policies
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { instituteId } = await requireTenantApiContext(request);

    const { batchId } = params;

    if (!batchId) {
      throw new ValidationError('Batch ID is required');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sessionType = searchParams.get('type') as 'manual' | 'automatic' | null;

    // Build query (RLS will filter automatically based on user role)
    let query = supabaseAdmin
      .from('attendance_sessions')
      .select(`
        *,
        batches(name),
        courses(name, code),
        profiles!attendance_sessions_created_by_fkey(
          id,
          email,
          first_name,
          last_name
        ),
        lessons(id, title) -- For automatic sessions
      `)
      .eq('batch_id', batchId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('session_date', { ascending: false });

    if (startDate) {
      query = query.gte('session_date', startDate);
    }

    if (endDate) {
      query = query.lte('session_date', endDate);
    }

    if (sessionType) {
      query = query.eq('session_type', sessionType);
    }

    const { data: sessions, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch sessions: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: sessions || [],
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

