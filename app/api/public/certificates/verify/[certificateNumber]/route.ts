/**
 * Public API: Certificate Verification
 * 
 * Endpoint for public certificate verification.
 * No authentication required - uses certificate number only.
 * Does not expose sensitive student data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  formatErrorResponse,
  ValidationError,
  NotFoundError,
} from '@/lib/errors/api-errors';

/**
 * GET /api/public/certificates/verify/[certificateNumber]
 * 
 * Verify a certificate by certificate number
 * 
 * Public endpoint - no authentication required
 * Returns minimal information for verification
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { certificateNumber: string } }
) {
  try {
    const { certificateNumber } = params;

    if (!certificateNumber?.trim()) {
      throw new ValidationError('Certificate number is required');
    }

    // Fetch certificate (no RLS - using admin client for public access)
    // Only return public-safe information
    const { data: certificate, error } = await supabaseAdmin
      .from('certificates')
      .select(`
        id,
        certificate_number,
        issued_at,
        institute_id,
        courses(name, code),
        batches(name, start_date, end_date)
      `)
      .eq('certificate_number', certificateNumber.trim().toUpperCase())
      .is('deleted_at', null)
      .single();

    if (error || !certificate) {
      throw new NotFoundError('Certificate not found or invalid');
    }

    // Fetch institute name separately
    const { data: institute } = await supabaseAdmin
      .from('institutes')
      .select('name')
      .eq('id', certificate.institute_id)
      .single();

    const course: any = Array.isArray((certificate as any).courses)
      ? (certificate as any).courses[0]
      : (certificate as any).courses;
    const batch: any = Array.isArray((certificate as any).batches)
      ? (certificate as any).batches[0]
      : (certificate as any).batches;

    // Return only public-safe information (no student data)
    return NextResponse.json({
      success: true,
      valid: true,
      data: {
        certificateNumber: certificate.certificate_number,
        courseName: course?.name ?? null,
        courseCode: course?.code ?? null,
        batchName: batch?.name ?? null,
        batchDuration: batch
          ? `${batch.start_date} to ${batch.end_date}`
          : null,
        instituteName: institute?.name || null,
        issuedAt: certificate.issued_at,
      },
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

