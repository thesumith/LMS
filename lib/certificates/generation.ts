/**
 * Certificate PDF Generation
 * 
 * Utilities for generating certificate PDFs.
 * In production, use a PDF generation library like pdfkit, puppeteer, or @react-pdf/renderer
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  generateCertificateNumber,
  uploadCertificatePDF,
} from '@/lib/storage/certificates';

export interface CertificateData {
  studentName: string;
  courseName: string;
  courseCode: string;
  batchName: string;
  batchStartDate: string;
  batchEndDate: string;
  certificateNumber: string;
  issueDate: string;
  instituteName: string;
}

/**
 * Generate certificate PDF
 * 
 * This is a placeholder. In production, use a PDF library like:
 * - pdfkit (Node.js)
 * - puppeteer (HTML to PDF)
 * - @react-pdf/renderer (React to PDF)
 * 
 * @param data - Certificate data
 * @returns PDF buffer
 */
export async function generateCertificatePDF(
  data: CertificateData
): Promise<Buffer> {
  // TODO: Implement actual PDF generation
  // Example using pdfkit:
  /*
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape' });
  
  // Add certificate design
  doc.fontSize(48).text('Certificate of Completion', { align: 'center' });
  doc.fontSize(24).text(`This is to certify that`, { align: 'center' });
  doc.fontSize(32).text(data.studentName, { align: 'center' });
  doc.fontSize(20).text(`has successfully completed`, { align: 'center' });
  doc.fontSize(28).text(data.courseName, { align: 'center' });
  doc.fontSize(18).text(`Batch: ${data.batchName}`, { align: 'center' });
  doc.fontSize(16).text(`Certificate Number: ${data.certificateNumber}`, { align: 'center' });
  doc.fontSize(14).text(`Issued on: ${new Date(data.issueDate).toLocaleDateString()}`, { align: 'center' });
  
  // Get PDF buffer
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => {});
  doc.end();
  
  return Buffer.concat(chunks);
  */
  
  // Placeholder: Return empty buffer
  // In production, replace with actual PDF generation
  return Buffer.from('PDF placeholder - implement actual PDF generation');
}

/**
 * Create and issue certificate
 * 
 * @param studentId - Student ID
 * @param courseId - Course ID
 * @param batchId - Batch ID
 * @param instituteId - Institute ID
 * @param issuedBy - User ID who issued (null for auto-generated)
 * @returns Certificate record
 */
export async function issueCertificate(
  studentId: string,
  courseId: string,
  batchId: string,
  instituteId: string,
  issuedBy: string | null = null
) {
  // Check if certificate already exists
  const existing = await supabaseAdmin
    .from('certificates')
    .select('id')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .eq('batch_id', batchId)
    .is('deleted_at', null)
    .single();

  if (existing.data) {
    throw new Error('Certificate already exists for this student/course/batch');
  }

  // Get student, course, and batch information
  const [studentResult, courseResult, batchResult] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', studentId)
      .single(),
    supabaseAdmin
      .from('courses')
      .select('name, code')
      .eq('id', courseId)
      .single(),
    supabaseAdmin
      .from('batches')
      .select('name, start_date, end_date')
      .eq('id', batchId)
      .single(),
  ]);

  if (studentResult.error || !studentResult.data) {
    throw new Error('Student not found');
  }
  if (courseResult.error || !courseResult.data) {
    throw new Error('Course not found');
  }
  if (batchResult.error || !batchResult.data) {
    throw new Error('Batch not found');
  }

  // Get institute name
  const { data: institute } = await supabaseAdmin
    .from('institutes')
    .select('name')
    .eq('id', instituteId)
    .single();

  // Generate certificate number
  const certificateNumber = await generateCertificateNumber(
    instituteId,
    courseId,
    batchId
  );

  // Prepare certificate data
  const certificateData: CertificateData = {
    studentName: `${studentResult.data.first_name} ${studentResult.data.last_name}`,
    courseName: courseResult.data.name,
    courseCode: courseResult.data.code,
    batchName: batchResult.data.name,
    batchStartDate: batchResult.data.start_date,
    batchEndDate: batchResult.data.end_date,
    certificateNumber,
    issueDate: new Date().toISOString(),
    instituteName: institute?.name || 'Institute',
  };

  // Generate PDF
  const pdfBuffer = await generateCertificatePDF(certificateData);

  // Upload PDF to storage
  const storagePath = `institute/${instituteId}/certificates/${certificateNumber}.pdf`;
  const uploadResult = await uploadCertificatePDF(pdfBuffer, storagePath);

  if (uploadResult.error) {
    throw new Error(`Failed to upload certificate: ${uploadResult.error}`);
  }

  // Create certificate record
  const { data: certificate, error: certError } = await supabaseAdmin
    .from('certificates')
    .insert({
      institute_id: instituteId,
      student_id: studentId,
      course_id: courseId,
      batch_id: batchId,
      certificate_number: certificateNumber,
      issued_at: new Date().toISOString(),
      issued_by: issuedBy,
      storage_path: uploadResult.path,
      is_reissued: false,
    })
    .select(`
      *,
      profiles!certificates_student_id_fkey(
        id,
        email,
        first_name,
        last_name
      ),
      courses(name, code),
      batches(name, start_date, end_date)
    `)
    .single();

  if (certError) {
    // Rollback: Delete uploaded file
    // await deleteCertificatePDF(uploadResult.path);
    throw new Error(`Failed to create certificate: ${certError.message}`);
  }

  return certificate;
}

