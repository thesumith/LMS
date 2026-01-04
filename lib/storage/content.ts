/**
 * Supabase Storage Content Management
 * 
 * Utilities for uploading, managing, and generating signed URLs for course content.
 * All files are stored in private buckets with path-based access control.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const BUCKET_NAME = 'course-content';

/**
 * Generate storage path for lesson content
 * 
 * Path structure: institute/{institute_id}/courses/{course_id}/lessons/{lesson_id}/{filename}
 */
export function generateStoragePath(
  instituteId: string,
  courseId: string,
  lessonId: string,
  filename: string
): string {
  // Sanitize filename (remove special characters, keep extension)
  const sanitizedFilename = filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_');

  return `institute/${instituteId}/courses/${courseId}/lessons/${lessonId}/${sanitizedFilename}`;
}

/**
 * Upload file to Supabase Storage
 * 
 * @param file - File to upload
 * @param storagePath - Path in storage bucket
 * @param contentType - MIME type of file
 * @returns Storage path and public URL (if public) or null
 */
export async function uploadContentFile(
  file: File | Buffer,
  storagePath: string,
  contentType: string
): Promise<{ path: string; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    // Convert File to ArrayBuffer if needed
    let fileData: ArrayBuffer;
    if (file instanceof File) {
      fileData = await file.arrayBuffer();
    } else {
      fileData = file;
    }

    // Upload file (RLS policies will enforce access control)
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileData, {
        contentType,
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      return { path: storagePath, error: error.message };
    }

    return { path: data.path };
  } catch (error) {
    return {
      path: storagePath,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate signed URL for private file access
 * 
 * @param storagePath - Path in storage bucket
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Signed URL or null if error
 */
export async function getSignedUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<{ url: string | null; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    // Generate signed URL (RLS policies will enforce access control)
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      return { url: null, error: error.message };
    }

    return { url: data.signedUrl };
  } catch (error) {
    return {
      url: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete file from storage
 * 
 * @param storagePath - Path in storage bucket
 * @returns Success status
 */
export async function deleteContentFile(
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    // Delete file (RLS policies will enforce access control)
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get file metadata
 * 
 * @param storagePath - Path in storage bucket
 * @returns File metadata or null
 */
export async function getFileMetadata(
  storagePath: string
): Promise<{ metadata: any | null; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    // Get file info (RLS policies will enforce access control)
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(storagePath.split('/').slice(0, -1).join('/'), {
        limit: 1,
        search: storagePath.split('/').pop(),
      });

    if (error) {
      return { metadata: null, error: error.message };
    }

    const file = data?.[0];
    return { metadata: file || null };
  } catch (error) {
    return {
      metadata: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Batch generate signed URLs for multiple files
 * 
 * @param storagePaths - Array of storage paths
 * @param expiresIn - Expiration time in seconds
 * @returns Map of path to signed URL
 */
export async function getBatchSignedUrls(
  storagePaths: string[],
  expiresIn: number = 3600
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();

  // Generate URLs in parallel
  const urlPromises = storagePaths.map(async (path) => {
    const { url } = await getSignedUrl(path, expiresIn);
    if (url) {
      urlMap.set(path, url);
    }
  });

  await Promise.all(urlPromises);

  return urlMap;
}

