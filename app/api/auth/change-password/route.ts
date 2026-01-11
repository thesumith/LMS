/**
 * Change Password API Route
 * 
 * Allows authenticated users to change their password.
 * Required when must_change_password is true.
 * 
 * Flow:
 * 1. Verify user is authenticated
 * 2. Validate current password
 * 3. Validate new password (min 8 characters, matches confirmation)
 * 4. Update password in auth.users
 * 5. Update must_change_password flag to false in profiles
 * 6. Return redirect URL based on user roles
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  formatErrorResponse,
  UnauthorizedError,
  ValidationError,
  InternalServerError,
} from '@/lib/errors/api-errors';

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export async function POST(request: NextRequest) {
  try {
    // Step 1: Get user session
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(
            _cookiesToSet: Array<{
              name: string;
              value: string;
              options?: Record<string, unknown>;
            }>
          ) {
            // Don't set cookies in this route - password change doesn't require new session
          },
        },
      }
    );

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const userId = session.user.id;

    // Step 2: Parse and validate request body
    const body: ChangePasswordRequest = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword?.trim()) {
      throw new ValidationError('Current password is required');
    }
    if (!newPassword?.trim()) {
      throw new ValidationError('New password is required');
    }
    if (newPassword.length < 8) {
      throw new ValidationError('New password must be at least 8 characters long');
    }
    if (newPassword !== confirmPassword) {
      throw new ValidationError('New password and confirmation do not match');
    }
    if (currentPassword === newPassword) {
      throw new ValidationError('New password must be different from current password');
    }

    // Step 3: Verify current password by attempting to sign in
    // This is the most secure way to verify the current password
    const testSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {
            // Don't set cookies for test client
          },
        },
      }
    );

    // NOTE: supabaseAdmin may not be strongly typed in this repo; avoid "never" inference during Next build typecheck.
    const admin = supabaseAdmin as any;

    const { data: userData } = await admin
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (!userData?.email) {
      throw new InternalServerError('User profile not found');
    }

    const { error: verifyError } = await testSupabase.auth.signInWithPassword({
      email: userData.email,
      password: currentPassword,
    });

    if (verifyError) {
      throw new ValidationError('Current password is incorrect');
    }

    // Step 4: Update password using admin client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      throw new InternalServerError(
        `Failed to update password: ${updateError.message}`
      );
    }

    // Step 5: Update must_change_password flag to false
    const { error: profileError } = await admin
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', userId);

    if (profileError) {
      // Password was updated, but profile update failed
      // Log error but don't fail the request - user can still use new password
      console.error('Failed to update must_change_password flag:', profileError);
    }

    // Step 6: Get user profile to determine redirect
    const { data: userProfile } = await admin
      .from('profiles')
      .select('institute_id')
      .eq('id', userId)
      .single();

    // Step 7: Return success response - redirect to login page
    // For non-SUPER_ADMIN users, redirect to their subdomain login
    // For SUPER_ADMIN, redirect to main domain login
    let redirectUrl = '/login';
    let redirectSubdomain: string | null = null;

    if (userProfile?.institute_id) {
      // Get institute subdomain
      const { data: institute } = await admin
        .from('institutes')
        .select('subdomain')
        .eq('id', userProfile.institute_id)
        .is('deleted_at', null)
        .single();
      
      if (institute) {
        redirectSubdomain = institute.subdomain;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully. Please log in with your new password.',
      redirect_url: redirectUrl,
      redirect_subdomain: redirectSubdomain,
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

