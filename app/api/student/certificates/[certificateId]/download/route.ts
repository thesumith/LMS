/**
 * Student API: Download Certificate
 * 
 * Endpoint for students to download their certificates.
 * Access: Students only (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTenantApiContext } from '@/lib/api/context';
import {
  formatErrorResponse,
  ValidationError,
  NotFoundError,
} from '@/lib/errors/api-errors';
import { getCertificateSignedUrl } from '@/lib/storage/certificates';

/**
 * GET /api/student/certificates/[certificateId]/download
 * 
 * Get signed URL for certificate download
 * 
 * Access: Students only
 * Enforced by: RLS policies
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { certificateId: string } }
) {
  try {
    const { instituteId, session } = await requireTenantApiContext(request);
    const userId = session.userId;

    const { certificateId } = params;

    if (!certificateId) {
      throw new ValidationError('Certificate ID is required');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const expiresIn = searchParams.get('expiresIn')
      ? parseInt(searchParams.get('expiresIn')!)
      : 3600; // Default: 1 hour

    // Fetch certificate (RLS will filter to student's own certificates)
    const { data: certificate, error: certError } = await supabaseAdmin
      .from('certificates')
      .select('id, storage_path, certificate_number')
      .eq('id', certificateId)
      .eq('student_id', userId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (certError || !certificate) {
      throw new NotFoundError('Certificate not found or access denied');
    }

    if (!certificate.storage_path) {
      throw new NotFoundError('Certificate PDF not found');
    }

    // Generate signed URL
    const { url, error: urlError } = await getCertificateSignedUrl(
      certificate.storage_path,
      expiresIn
    );

    if (urlError || !url) {
      throw new Error(`Failed to generate download URL: ${urlError || 'Unknown error'}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        certificateId: certificate.id,
        certificateNumber: certificate.certificate_number,
        downloadUrl: url,
        expiresIn,
      },
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

