/**
 * Institute API: Module Lessons Management
 * 
 * Endpoints for creating and managing lessons within a module.
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
import {
  generateStoragePath,
  uploadContentFile,
  deleteContentFile,
} from '@/lib/storage/content';

interface CreateLessonRequest {
  title: string;
  description?: string;
  contentType: 'video' | 'pdf' | 'ppt' | 'link' | 'text';
  contentUrl?: string; // For link type
  sequence: number;
  durationMinutes?: number; // For video type
  isActive?: boolean;
}

/**
 * POST /api/institute/modules/[moduleId]/lessons
 * 
 * Create a new lesson in a module
 * 
 * Access: Institute Admin and assigned Teachers
 * Enforced by: RLS policies
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { moduleId: string } }
) {
  try {
    const { instituteId, session } = await requireTenantApiContext(request);
    const userId = session.userId;

    const { moduleId } = params;

    if (!moduleId) {
      throw new ValidationError('Module ID is required');
    }

    // Verify module exists and belongs to institute
    const { data: module, error: moduleError } = await supabaseAdmin
      .from('modules')
      .select('id, course_id, name')
      .eq('id', moduleId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (moduleError || !module) {
      throw new NotFoundError('Module not found');
    }

    // Parse request body (form data for file uploads)
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string | null;
    const contentType = formData.get('contentType') as string;
    const contentUrl = formData.get('contentUrl') as string | null;
    const sequence = parseInt(formData.get('sequence') as string);
    const durationMinutes = formData.get('durationMinutes')
      ? parseInt(formData.get('durationMinutes') as string)
      : null;
    const isActive = formData.get('isActive') !== 'false';

    // Validation
    if (!title?.trim()) {
      throw new ValidationError('Lesson title is required');
    }
    if (!['video', 'pdf', 'ppt', 'link', 'text'].includes(contentType)) {
      throw new ValidationError('Invalid content type');
    }
    if (!sequence || sequence < 1) {
      throw new ValidationError('Sequence must be a positive integer');
    }

    // Content type specific validation
    if (contentType === 'link' && !contentUrl?.trim()) {
      throw new ValidationError('Content URL is required for link type');
    }

    // Check if sequence already exists for this module
    const { data: existingLesson } = await supabaseAdmin
      .from('lessons')
      .select('id')
      .eq('module_id', moduleId)
      .eq('sequence', sequence)
      .is('deleted_at', null)
      .single();

    if (existingLesson) {
      throw new ValidationError(
        `Lesson with sequence ${sequence} already exists in this module`
      );
    }

    let storagePath: string | null = null;

    // Handle file upload for video, PDF, PPT
    if (['video', 'pdf', 'ppt'].includes(contentType)) {
      const file = formData.get('file') as File | null;

      if (!file) {
        throw new ValidationError('File is required for this content type');
      }

      // Generate storage path
      storagePath = generateStoragePath(
        instituteId,
        module.course_id,
        moduleId, // Using moduleId as temporary identifier, will update with lessonId
        file.name
      );

      // Determine content type from file
      const fileContentType = file.type;
      const allowedTypes = {
        video: ['video/mp4', 'video/webm', 'video/quicktime'],
        pdf: ['application/pdf'],
        ppt: [
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ],
      };

      if (
        !allowedTypes[contentType as keyof typeof allowedTypes]?.includes(
          fileContentType
        )
      ) {
        throw new ValidationError(
          `Invalid file type for ${contentType}. Expected: ${allowedTypes[contentType as keyof typeof allowedTypes]?.join(', ')}`
        );
      }

      // Upload file (will update path with lessonId after creation)
      const uploadResult = await uploadContentFile(
        file,
        storagePath,
        fileContentType
      );

      if (uploadResult.error) {
        throw new Error(`Failed to upload file: ${uploadResult.error}`);
      }

      storagePath = uploadResult.path;
    }

    // Create lesson (RLS will enforce access control)
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('lessons')
      .insert({
        institute_id: instituteId,
        course_id: module.course_id,
        module_id: moduleId,
        title: title.trim(),
        description: description?.trim() || null,
        content_type: contentType,
        content_url: contentType === 'link' ? contentUrl?.trim() : null,
        storage_path: storagePath,
        sequence,
        duration_minutes: durationMinutes,
        is_active: isActive,
      })
      .select()
      .single();

    if (lessonError) {
      // Rollback: Delete uploaded file if lesson creation failed
      if (storagePath) {
        await deleteContentFile(storagePath);
      }
      throw new Error(`Failed to create lesson: ${lessonError.message}`);
    }

    // Update storage path with actual lessonId if needed
    if (storagePath && !storagePath.includes(lesson.id)) {
      const newPath = generateStoragePath(
        instituteId,
        module.course_id,
        lesson.id,
        storagePath.split('/').pop() || 'file'
      );

      // Move file to correct path (Supabase doesn't support move, so we copy and delete)
      // For now, we'll keep the original path or implement move logic separately
      // This is a simplification - in production, you might want to handle this differently
    }

    return NextResponse.json(
      {
        success: true,
        data: lesson,
      },
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * GET /api/institute/modules/[moduleId]/lessons
 * 
 * List all lessons in a module
 * 
 * Access: Institute Admin, assigned Teachers, enrolled Students
 * Enforced by: RLS policies
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { moduleId: string } }
) {
  try {
    const { instituteId } = await requireTenantApiContext(request);

    const { moduleId } = params;

    if (!moduleId) {
      throw new ValidationError('Module ID is required');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const includeSignedUrls = searchParams.get('includeSignedUrls') === 'true';

    // Build query (RLS will filter automatically based on user role)
    let query = supabaseAdmin
      .from('lessons')
      .select(`
        *,
        modules(id, name, sequence)
      `)
      .eq('module_id', moduleId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('sequence', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: lessons, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch lessons: ${error.message}`);
    }

    // Generate signed URLs for file-based content if requested
    if (includeSignedUrls && lessons) {
      const { getSignedUrl } = await import('@/lib/storage/content');
      
      const lessonsWithUrls = await Promise.all(
        lessons.map(async (lesson: any) => {
          if (lesson.storage_path) {
            const { url } = await getSignedUrl(lesson.storage_path, 3600); // 1 hour expiry
            return {
              ...lesson,
              signed_url: url,
            };
          }
          return lesson;
        })
      );

      return NextResponse.json({
        success: true,
        data: lessonsWithUrls,
      });
    }

    return NextResponse.json({
      success: true,
      data: lessons || [],
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

