/**
 * Institute API: Batch Class Sessions (Live Classes)
 *
 * Teachers can schedule classes for batches they are assigned to.
 * Students can view classes for batches they are enrolled in.
 *
 * Access is enforced by Supabase RLS using the server client (NOT service role).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireTenantApiContext } from '@/lib/api/context';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatErrorResponse, NotFoundError, ValidationError } from '@/lib/errors/api-errors';

interface CreateClassSessionRequest {
  title: string;
  description?: string;
  scheduledAt: string; // ISO timestamp
  durationMinutes?: number | null;
  meetingLink: string;
}

export async function POST(request: NextRequest, { params }: { params: { batchId: string } }) {
  try {
    const { instituteId, session } = await requireTenantApiContext(request);
    const { batchId } = params;

    if (!batchId) throw new ValidationError('Batch ID is required');

    const body: CreateClassSessionRequest = await request.json();
    const title = body.title?.trim();
    const description = body.description?.trim() || null;
    const scheduledAt = body.scheduledAt;
    const meetingLink = body.meetingLink?.trim();
    const durationMinutes =
      body.durationMinutes === undefined || body.durationMinutes === null
        ? null
        : Number(body.durationMinutes);

    if (!title) throw new ValidationError('Class title is required');
    if (!scheduledAt) throw new ValidationError('Scheduled time is required');
    if (!meetingLink) throw new ValidationError('Meeting link is required');

    const scheduled = new Date(scheduledAt);
    if (isNaN(scheduled.getTime())) throw new ValidationError('Invalid scheduledAt');

    if (durationMinutes !== null) {
      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        throw new ValidationError('durationMinutes must be a positive number');
      }
      if (durationMinutes > 24 * 60) {
        throw new ValidationError('durationMinutes is too large');
      }
    }

    const supabase = await createSupabaseServerClient();

    // Ensure batch exists and belongs to institute (also helps derive course_id)
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('id, institute_id, course_id')
      .eq('id', batchId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (batchError || !batch) throw new NotFoundError('Batch not found');

    // Insert (RLS enforced)
    const { data: created, error: createError } = await supabase
      .from('class_sessions')
      .insert({
        institute_id: batch.institute_id,
        course_id: batch.course_id,
        batch_id: batchId,
        teacher_id: session.userId,
        title,
        description,
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
        meeting_link: meetingLink,
      })
      .select(
        `
        id,
        title,
        description,
        scheduled_at,
        duration_minutes,
        meeting_link,
        is_cancelled,
        created_at,
        updated_at,
        batches(name),
        courses(name, code),
        profiles!class_sessions_teacher_id_fkey(id, email, first_name, last_name)
      `
      )
      .single();

    if (createError) {
      throw new Error(`Failed to create class: ${createError.message}`);
    }

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function GET(request: NextRequest, { params }: { params: { batchId: string } }) {
  try {
    const { instituteId } = await requireTenantApiContext(request);
    const { batchId } = params;

    if (!batchId) throw new ValidationError('Batch ID is required');

    const { searchParams } = new URL(request.url);
    const upcomingOnly = searchParams.get('upcoming') === 'true';

    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from('class_sessions')
      .select(
        `
        id,
        title,
        description,
        scheduled_at,
        duration_minutes,
        meeting_link,
        is_cancelled,
        created_at,
        updated_at,
        batches(name),
        courses(name, code),
        profiles!class_sessions_teacher_id_fkey(id, email, first_name, last_name)
      `
      )
      .eq('institute_id', instituteId)
      .eq('batch_id', batchId)
      .is('deleted_at', null)
      .order('scheduled_at', { ascending: true });

    if (upcomingOnly) {
      query = query.gte('scheduled_at', new Date().toISOString());
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch classes: ${error.message}`);

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}


