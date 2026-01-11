/**
 * Institute API: Lesson Content Access
 * 
 * Endpoint for fetching lesson content with signed URLs.
 * Access: Institute Admin, assigned Teachers, enrolled Students (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTenantApiContext } from '@/lib/api/context';
import {
  formatErrorResponse,
  ValidationError,
  NotFoundError,
} from '@/lib/errors/api-errors';
import { getSignedUrl } from '@/lib/storage/content';

/**
 * GET /api/institute/lessons/[lessonId]/content
 * 
 * Get lesson content with signed URL (for file-based content)
 * 
 * Access: Institute Admin, assigned Teachers, enrolled Students
 * Enforced by: RLS policies
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { lessonId: string } }
) {
  try {
    const { instituteId } = await requireTenantApiContext(request);

    const { lessonId } = params;

    if (!lessonId) {
      throw new ValidationError('Lesson ID is required');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const expiresIn = searchParams.get('expiresIn')
      ? parseInt(searchParams.get('expiresIn')!)
      : 3600; // Default: 1 hour

    // Fetch lesson (RLS will enforce access control)
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('lessons')
      .select(`
        *,
        modules(id, name, sequence),
        courses(id, name, code)
      `)
      .eq('id', lessonId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (lessonError || !lesson) {
      throw new NotFoundError('Lesson not found or access denied');
    }

    // Generate signed URL for file-based content
    let signedUrl: string | null = null;

    if (lesson.storage_path) {
      const { url, error: urlError } = await getSignedUrl(
        lesson.storage_path,
        expiresIn
      );

      if (urlError) {
        // Log error but don't fail the request
        console.error('Failed to generate signed URL:', urlError);
      } else {
        signedUrl = url;
      }
    }

    // Return lesson with signed URL if applicable
    return NextResponse.json({
      success: true,
      data: {
        ...lesson,
        signed_url: signedUrl,
        // Don't expose storage_path to client
        storage_path: undefined,
      },
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

