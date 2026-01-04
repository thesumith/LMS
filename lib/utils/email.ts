/**
 * Email Service
 * 
 * Sends emails for institute onboarding and user management.
 * Uses Gmail SMTP via nodemailer.
 * 
 * Note: Email sending is async and should not block the API response.
 * Failures are logged but don't cause transaction rollback.
 */

import nodemailer from 'nodemailer';

interface OnboardingEmailParams {
  email: string;
  instituteName: string;
  subdomain: string;
  temporaryPassword: string;
  adminName: string;
}

/**
 * Create Gmail transporter
 */
function createTransporter() {
  // Gmail SMTP configuration
  // Using environment variables for security (fallback to provided credentials)
  const gmailUser = process.env.GMAIL_USER || 'sumithsubhanjirao@gmail.com';
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || 'ifzghgoxddawfycq';

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });
}

/**
 * Send onboarding email to Institute Admin
 * 
 * This function should be called asynchronously after the transaction completes.
 * Email failures should not rollback the database transaction.
 */
export async function sendOnboardingEmail(
  params: OnboardingEmailParams
): Promise<void> {
  const { email, instituteName, subdomain, temporaryPassword, adminName } = params;

  // Determine base URL from environment
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const loginUrl = `${baseUrl.replace(/^https?:\/\//, '').includes('.') ? baseUrl : baseUrl.replace(/^https?:\/\//, `http://${subdomain}.`)}/login`;

  const emailSubject = `Welcome to ${instituteName} - Your Krrch LMS Access`;

  const emailText = `
Welcome to ${instituteName}!

Your institute has been set up on Krrch LMS.

Login Details:
- Email: ${email}
- Temporary Password: ${temporaryPassword}
- Login URL: ${loginUrl}

IMPORTANT: You must change your password on first login.

Next Steps:
1. Visit the login URL above
2. Sign in with your temporary password
3. You will be prompted to change your password
4. Once logged in, you can start managing your institute

If you have any questions, please contact support.

Best regards,
The Krrch-LMS Team
  `.trim();

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${instituteName}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #2563eb; margin-top: 0;">Welcome to ${instituteName}!</h1>
  </div>
  
  <p>Your institute has been set up on <strong>Krrch LMS</strong>.</p>
  
  <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
    <h2 style="margin-top: 0; color: #1e40af;">Login Details</h2>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Temporary Password:</strong> <code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${temporaryPassword}</code></p>
    <p><strong>Login URL:</strong> <a href="${loginUrl}" style="color: #2563eb;">${loginUrl}</a></p>
  </div>
  
  <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
    <p style="margin: 0;"><strong>⚠️ IMPORTANT:</strong> You must change your password on first login.</p>
  </div>
  
  <div style="margin: 20px 0;">
    <h2 style="color: #1e40af;">Next Steps</h2>
    <ol style="padding-left: 20px;">
      <li>Visit the login URL above</li>
      <li>Sign in with your temporary password</li>
      <li>You will be prompted to change your password</li>
      <li>Once logged in, you can start managing your institute</li>
    </ol>
  </div>
  
  <p>If you have any questions, please contact support.</p>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
    <p style="margin: 0;">Best regards,<br><strong>The Krrch-LMS Team</strong></p>
  </div>
</body>
</html>
  `.trim();

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: {
        name: 'Krrch-LMS',
        address: process.env.GMAIL_USER || 'sumithsubhanjirao@gmail.com',
      },
      to: email,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully:', info.messageId);
    console.log('Email sent to:', email);
  } catch (error) {
    console.error('Error sending onboarding email:', error);
    // Don't throw - email failure shouldn't break the flow
    
    // In development, also log what would have been sent
    if (process.env.NODE_ENV === 'development') {
      console.log('=== ONBOARDING EMAIL (FAILED TO SEND) ===');
      console.log(`To: ${email}`);
      console.log(`Subject: ${emailSubject}`);
      console.log(`Body:\n${emailText}`);
      console.log('===================================');
    }
  }
}
