/**
 * Student API: View Own Certificates
 * 
 * Endpoint for students to view and download their certificates.
 * Access: Students only (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  formatErrorResponse,
  UnauthorizedError,
  ValidationError,
} from '@/lib/errors/api-errors';
import { getCertificateSignedUrl } from '@/lib/storage/certificates';

/**
 * GET /api/student/certificates
 * 
 * Get student's own certificates
 * 
 * Query Parameters:
 * - courseId: Filter by course
 * - batchId: Filter by batch
 * - includeSignedUrl: Include signed URL for download
 * 
 * Access: Students only
 * Enforced by: RLS policies
 */
export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const batchId = searchParams.get('batchId');
    const includeSignedUrl = searchParams.get('includeSignedUrl') === 'true';

    // Build query (RLS will filter to student's own certificates)
    let query = supabaseAdmin
      .from('certificates')
      .select(`
        *,
        courses(name, code),
        batches(name, start_date, end_date)
      `)
      .eq('student_id', userId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('issued_at', { ascending: false });

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    if (batchId) {
      query = query.eq('batch_id', batchId);
    }

    const { data: certificates, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch certificates: ${error.message}`);
    }

    // Generate signed URLs if requested
    if (includeSignedUrl && certificates) {
      const certificatesWithUrls = await Promise.all(
        certificates.map(async (cert: any) => {
          if (cert.storage_path) {
            const { url } = await getCertificateSignedUrl(cert.storage_path, 3600); // 1 hour expiry
            return {
              ...cert,
              signed_url: url,
              // Don't expose storage_path to client
              storage_path: undefined,
            };
          }
          return cert;
        })
      );

      return NextResponse.json({
        success: true,
        data: certificatesWithUrls,
      });
    }

    return NextResponse.json({
      success: true,
      data: certificates || [],
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

