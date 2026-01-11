/**
 * Institute API: Certificate Issuance
 * 
 * Endpoint for issuing certificates (manual or automatic).
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
import { evaluateEligibility, checkExistingCertificate } from '@/lib/certificates/eligibility';
import { issueCertificate } from '@/lib/certificates/generation';

interface IssueCertificateRequest {
  studentId: string;
  courseId: string;
  batchId: string;
  skipEligibilityCheck?: boolean; // For manual issuance by admin
}

/**
 * POST /api/institute/certificates/issue
 * 
 * Issue a certificate for a student
 * 
 * Access: Institute Admin only
 * Enforced by: RLS policies
 */
export async function POST(request: NextRequest) {
  try {
    const { instituteId, session } = await requireTenantApiContext(request);
    const userId = session.userId;

    // Parse request body
    const body: IssueCertificateRequest = await request.json();
    const { studentId, courseId, batchId, skipEligibilityCheck = false } = body;

    // Validation
    if (!studentId?.trim()) {
      throw new ValidationError('Student ID is required');
    }
    if (!courseId?.trim()) {
      throw new ValidationError('Course ID is required');
    }
    if (!batchId?.trim()) {
      throw new ValidationError('Batch ID is required');
    }

    // Check if certificate already exists
    const existing = await checkExistingCertificate(studentId, courseId, batchId);
    if (existing) {
      throw new ValidationError(
        'Certificate already exists for this student/course/batch combination'
      );
    }

    // Evaluate eligibility (unless skipped by admin)
    if (!skipEligibilityCheck) {
      const eligibility = await evaluateEligibility(studentId, courseId, batchId);

      if (!eligibility.isEligible) {
        return NextResponse.json(
          {
            success: false,
            message: 'Student does not meet eligibility requirements',
            data: {
              eligibility,
            },
          },
          { status: 400 }
        );
      }
    }

    // Issue certificate
    const certificate = await issueCertificate(
      studentId,
      courseId,
      batchId,
      instituteId,
      userId
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Certificate issued successfully',
        data: certificate,
      },
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

