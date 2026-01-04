/**
 * Email Service
 * 
 * Sends emails for institute onboarding and user management.
 * Uses Supabase Edge Functions or external email service (Resend, SendGrid, etc.)
 * 
 * Note: Email sending is async and should not block the API response.
 * Failures are logged but don't cause transaction rollback.
 */

interface OnboardingEmailParams {
  email: string;
  instituteName: string;
  subdomain: string;
  temporaryPassword: string;
  adminName: string;
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yourplatform.com';
  const loginUrl = `${baseUrl.replace('://', `://${subdomain}.`)}/auth/login`;

  const emailBody = `
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
The Platform Team
  `.trim();

  // TODO: Integrate with your email service
  // Options:
  // 1. Supabase Edge Function (recommended for Supabase projects)
  // 2. Resend API (https://resend.com)
  // 3. SendGrid API
  // 4. AWS SES
  // 5. Postmark

  // Example using fetch to Supabase Edge Function:
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        to: email,
        subject: `Welcome to ${instituteName} - Your Krrch LMS Access`,
        html: emailBody.replace(/\n/g, '<br>'),
        text: emailBody,
      }),
    });

    if (!response.ok) {
      console.error('Failed to send onboarding email:', await response.text());
      // Don't throw - email failure shouldn't break the flow
    }
  } catch (error) {
    console.error('Error sending onboarding email:', error);
    // Don't throw - email failure shouldn't break the flow
  }

  // For development, log the email instead
  if (process.env.NODE_ENV === 'development') {
    console.log('=== ONBOARDING EMAIL (DEV MODE) ===');
    console.log(`To: ${email}`);
    console.log(`Subject: Welcome to ${instituteName} - Your Krrch LMS Access`);
    console.log(`Body:\n${emailBody}`);
    console.log('===================================');
  }
}

