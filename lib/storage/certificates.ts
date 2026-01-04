/**
 * Supabase Storage Certificate Management
 * 
 * Utilities for uploading and managing certificate PDFs.
 * All certificates are stored in private buckets with path-based access control.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const BUCKET_NAME = 'course-content'; // Using same bucket as course content

/**
 * Generate certificate number
 * 
 * Uses database function to generate unique certificate number
 */
export async function generateCertificateNumber(
  instituteId: string,
  courseId: string,
  batchId: string
): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('generate_certificate_number', {
    p_institute_id: instituteId,
    p_course_id: courseId,
    p_batch_id: batchId,
  });

  if (error || !data) {
    throw new Error(`Failed to generate certificate number: ${error?.message}`);
  }

  return data;
}

/**
 * Upload certificate PDF to Supabase Storage
 * 
 * @param pdfBuffer - PDF file buffer
 * @param storagePath - Path in storage bucket
 * @returns Storage path and error (if any)
 */
export async function uploadCertificatePDF(
  pdfBuffer: Buffer,
  storagePath: string
): Promise<{ path: string; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    // Upload PDF (RLS policies will enforce access control)
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false, // Don't overwrite existing certificates
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
 * Generate signed URL for certificate download
 * 
 * @param storagePath - Path in storage bucket
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Signed URL or null if error
 */
export async function getCertificateSignedUrl(
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
 * Delete certificate PDF from storage
 * 
 * @param storagePath - Path in storage bucket
 * @returns Success status
 */
export async function deleteCertificatePDF(
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

