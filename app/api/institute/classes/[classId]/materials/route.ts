/**
 * Institute API: Class Session Materials
 *
 * - GET: list materials for a class session (students/teachers/admin; RLS enforced)
 * - POST: upload a material file for a class session (teachers/admin; RLS + Storage policies enforced)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireTenantApiContext } from '@/lib/api/context';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatErrorResponse, NotFoundError, ValidationError } from '@/lib/errors/api-errors';
import {
  generateClassSessionMaterialPath,
  getSignedUrl,
  uploadContentFile,
} from '@/lib/storage/content';

export async function GET(request: NextRequest, { params }: { params: { classId: string } }) {
  try {
    const { instituteId } = await requireTenantApiContext(request);
    const { classId } = params;
    if (!classId) throw new ValidationError('Class ID is required');

    const supabase = await createSupabaseServerClient();

    // Ensure class exists in this institute (and is visible to caller via RLS)
    const { data: cs, error: csError } = await supabase
      .from('class_sessions')
      .select('id')
      .eq('id', classId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (csError || !cs) throw new NotFoundError('Class not found');

    const { data: materials, error } = await supabase
      .from('class_session_materials')
      .select(
        `
        id,
        title,
        storage_path,
        content_type,
        file_size_bytes,
        created_at,
        profiles!class_session_materials_uploaded_by_fkey(id, email, first_name, last_name)
      `
      )
      .eq('institute_id', instituteId)
      .eq('class_session_id', classId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch materials: ${error.message}`);

    const enriched = await Promise.all(
      (materials || []).map(async (m: any) => {
        const { url } = await getSignedUrl(m.storage_path, 3600);
        return { ...m, signed_url: url };
      })
    );

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(request: NextRequest, { params }: { params: { classId: string } }) {
  try {
    const { instituteId, session } = await requireTenantApiContext(request);
    const { classId } = params;
    if (!classId) throw new ValidationError('Class ID is required');

    const form = await request.formData();
    const file = form.get('file');
    const titleRaw = form.get('title');

    if (!(file instanceof File)) throw new ValidationError('file is required');
    const title = typeof titleRaw === 'string' ? titleRaw.trim() : file.name;
    if (!title?.trim()) throw new ValidationError('title is required');

    const supabase = await createSupabaseServerClient();

    // Fetch class session for path derivation (RLS enforced)
    const { data: cs, error: csError } = await supabase
      .from('class_sessions')
      .select('id, institute_id, course_id, batch_id')
      .eq('id', classId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (csError || !cs) throw new NotFoundError('Class not found');

    const storagePath = generateClassSessionMaterialPath(
      instituteId,
      cs.course_id,
      cs.batch_id,
      classId,
      file.name
    );

    const upload = await uploadContentFile(file, storagePath, file.type || 'application/octet-stream');
    if (upload.error) {
      throw new Error(`Failed to upload material: ${upload.error}`);
    }

    // Record material metadata (RLS enforced)
    const { data: created, error: insertError } = await supabase
      .from('class_session_materials')
      .insert({
        institute_id: instituteId,
        class_session_id: classId,
        uploaded_by: session.userId,
        title,
        storage_path: upload.path,
        content_type: file.type || null,
        file_size_bytes: typeof file.size === 'number' ? file.size : null,
      })
      .select(
        `
        id,
        title,
        storage_path,
        content_type,
        file_size_bytes,
        created_at
      `
      )
      .single();

    if (insertError) {
      // Best-effort cleanup to avoid orphaned storage objects
      // (If cleanup fails due to permissions, the file remains but is not linked to any session.)
      try {
        const sb = await createSupabaseServerClient();
        await sb.storage.from('course-content').remove([upload.path]);
      } catch {}
      throw new Error(`Failed to save material metadata: ${insertError.message}`);
    }

    const { url } = await getSignedUrl(created.storage_path, 3600);

    return NextResponse.json({ success: true, data: { ...created, signed_url: url } }, { status: 201 });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}


