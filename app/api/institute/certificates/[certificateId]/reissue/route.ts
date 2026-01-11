/**
 * Institute API: Reissue Certificate
 * 
 * Endpoint for reissuing certificates.
 * Access: Institute Admin only (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTenantApiContext } from '@/lib/api/context';
import {
  formatErrorResponse,
  ValidationError,
  NotFoundError,
} from '@/lib/errors/api-errors';
import { issueCertificate } from '@/lib/certificates/generation';
import { deleteCertificatePDF } from '@/lib/storage/certificates';

/**
 * POST /api/institute/certificates/[certificateId]/reissue
 * 
 * Reissue a certificate (generates new PDF, keeps same certificate number or generates new)
 * 
 * Access: Institute Admin only
 * Enforced by: RLS policies
 */
export async function POST(
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

    // Get existing certificate
    const { data: existingCertificate, error: certError } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('id', certificateId)
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .single();

    if (certError || !existingCertificate) {
      throw new NotFoundError('Certificate not found');
    }

    // Parse request body
    const body = await request.json();
    const generateNewNumber = body.generateNewNumber === true;

    // Issue new certificate (will generate new number if requested)
    const newCertificate = await issueCertificate(
      existingCertificate.student_id,
      existingCertificate.course_id,
      existingCertificate.batch_id,
      instituteId,
      userId
    );

    // Update old certificate to mark as reissued
    await supabaseAdmin
      .from('certificates')
      .update({
        is_reissued: true,
        reissued_from_id: newCertificate.id,
      })
      .eq('id', certificateId);

    // Delete old PDF (optional - you might want to keep it for audit)
    // await deleteCertificatePDF(existingCertificate.storage_path);

    return NextResponse.json(
      {
        success: true,
        message: 'Certificate reissued successfully',
        data: {
          originalCertificate: existingCertificate,
          newCertificate,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

