/**
 * Super Admin API: Create Institute and Institute Admin
 * 
 * This endpoint allows SUPER_ADMIN to create a new institute and its first admin.
 * 
 * Flow:
 * 1. Verify SUPER_ADMIN authorization
 * 2. Validate input (subdomain uniqueness, email format)
 * 3. Create institute (transaction start)
 * 4. Create auth user with temporary password
 * 5. Create profile linked to auth user
 * 6. Assign INSTITUTE_ADMIN role
 * 7. Send onboarding email (async, non-blocking)
 * 8. Return success response
 * 
 * If any step fails, rollback all changes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifySuperAdmin, getCurrentUserId } from '@/lib/auth/verify-super-admin';
import { generateTemporaryPassword, validateSubdomain } from '@/lib/utils/password';
import { sendOnboardingEmail } from '@/lib/utils/email';
import {
  formatErrorResponse,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  InternalServerError,
} from '@/lib/errors/api-errors';

/**
 * GET /api/super-admin/institutes
 * 
 * Fetches all institutes (for super admin)
 */
export async function GET(request: NextRequest) {
  try {
    // Step 1: Verify authentication
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    // Step 2: Verify SUPER_ADMIN authorization
    const isSuperAdmin = await verifySuperAdmin(userId);
    if (!isSuperAdmin) {
      throw new ForbiddenError('Only SUPER_ADMIN can view institutes');
    }

    // Step 3: Fetch all institutes
    const { data: institutes, error: institutesError } = await supabaseAdmin
      .from('institutes')
      .select('id, name, subdomain, status, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (institutesError) {
      throw new InternalServerError(
        `Failed to fetch institutes: ${institutesError.message}`
      );
    }

    return NextResponse.json({
      success: true,
      data: institutes || [],
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

interface CreateInstituteRequest {
  instituteName: string;
  subdomain: string;
  adminName: string;
  adminEmail: string;
  adminPassword?: string; // Optional: If provided, use this password; otherwise generate temporary password
}

/**
 * POST /api/super-admin/institutes
 * 
 * Creates a new institute and its Institute Admin
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Verify authentication
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    // Step 2: Verify SUPER_ADMIN authorization
    const isSuperAdmin = await verifySuperAdmin(userId);
    if (!isSuperAdmin) {
      throw new ForbiddenError('Only SUPER_ADMIN can create institutes');
    }

    // Step 3: Parse and validate request body
    const body: CreateInstituteRequest = await request.json();
    const { instituteName, subdomain, adminName, adminEmail, adminPassword } = body;

    // Validation
    if (!instituteName?.trim()) {
      throw new ValidationError('Institute name is required');
    }
    if (!subdomain?.trim()) {
      throw new ValidationError('Subdomain is required');
    }
    if (!validateSubdomain(subdomain.trim().toLowerCase())) {
      throw new ValidationError(
        'Subdomain must be 3-63 characters, lowercase alphanumeric with hyphens only'
      );
    }
    if (!adminName?.trim()) {
      throw new ValidationError('Admin name is required');
    }
    if (!adminEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) {
      throw new ValidationError('Valid admin email is required');
    }
    // Validate password if provided (minimum 8 characters)
    if (adminPassword !== undefined && adminPassword !== null) {
      if (adminPassword.length < 8) {
        throw new ValidationError('Password must be at least 8 characters long');
      }
    }

    const normalizedSubdomain = subdomain.trim().toLowerCase();
    const normalizedEmail = adminEmail.trim().toLowerCase();

    // Step 4: Check subdomain uniqueness
    const { data: existingInstitute } = await supabaseAdmin
      .from('institutes')
      .select('id')
      .eq('subdomain', normalizedSubdomain)
      .is('deleted_at', null)
      .single();

    if (existingInstitute) {
      throw new ConflictError('Subdomain already exists');
    }

    // Step 5: Check if email already exists in auth.users
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(
      normalizedEmail
    );

    if (existingUser?.user) {
      throw new ConflictError('Email already registered');
    }

    // Step 6: Use provided password or generate temporary password
    const password = adminPassword?.trim() || generateTemporaryPassword();
    const isTemporaryPassword = !adminPassword;

    // Step 7: Begin transaction-like operations
    // Note: Supabase doesn't support explicit transactions across auth and database
    // We'll use manual rollback on errors

    let createdInstituteId: string | null = null;
    let createdUserId: string | null = null;

    try {
      // Step 7a: Create institute
      const { data: institute, error: instituteError } = await supabaseAdmin
        .from('institutes')
        .insert({
          name: instituteName.trim(),
          subdomain: normalizedSubdomain,
          status: 'active',
        })
        .select('id')
        .single();

      if (instituteError || !institute) {
        throw new InternalServerError(
          `Failed to create institute: ${instituteError?.message}`
        );
      }

      createdInstituteId = institute.id;

      // Step 7b: Create auth user with password
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: password,
        email_confirm: true, // Auto-confirm email (admin-created user)
        user_metadata: {
          name: adminName.trim(),
          institute_id: createdInstituteId,
        },
      });

      if (authError || !authUser.user) {
        // Rollback: Delete institute
        await supabaseAdmin
          .from('institutes')
          .delete()
          .eq('id', createdInstituteId);

        throw new InternalServerError(
          `Failed to create auth user: ${authError?.message}`
        );
      }

      createdUserId = authUser.user.id;

      // Step 7c: Create profile linked to auth user
      const nameParts = adminName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: createdUserId,
          institute_id: createdInstituteId,
          email: normalizedEmail,
          first_name: firstName,
          last_name: lastName,
          must_change_password: isTemporaryPassword, // Only require password change if temporary password was used
          is_active: true,
        });

      if (profileError) {
        // Rollback: Delete auth user and institute
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        await supabaseAdmin
          .from('institutes')
          .delete()
          .eq('id', createdInstituteId);

        throw new InternalServerError(
          `Failed to create profile: ${profileError.message}`
        );
      }

      // Step 7d: Assign INSTITUTE_ADMIN role (simplified - use role_name directly)
      const { error: roleAssignmentError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: createdUserId,
          role_name: 'INSTITUTE_ADMIN',
          institute_id: createdInstituteId,
        });

      if (roleAssignmentError) {
        // Rollback: Delete profile, auth user, and institute
        await supabaseAdmin.from('profiles').delete().eq('id', createdUserId);
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        await supabaseAdmin
          .from('institutes')
          .delete()
          .eq('id', createdInstituteId);

        throw new InternalServerError(
          `Failed to assign role: ${roleAssignmentError.message}`
        );
      }

      // Step 8: Send onboarding email (async, non-blocking) only if temporary password was generated
      // Don't await - email failure shouldn't rollback the transaction
      if (isTemporaryPassword) {
        sendOnboardingEmail({
          email: normalizedEmail,
          instituteName: instituteName.trim(),
          subdomain: normalizedSubdomain,
          temporaryPassword: password,
          adminName: adminName.trim(),
        }).catch((error) => {
          // Log email failure but don't throw
          console.error('Failed to send onboarding email:', error);
        });
      }

      // Step 9: Return success response
      return NextResponse.json(
        {
          success: true,
          data: {
            institute: {
              id: createdInstituteId,
              name: instituteName.trim(),
              subdomain: normalizedSubdomain,
            },
            admin: {
              id: createdUserId,
              email: normalizedEmail,
              name: adminName.trim(),
            },
            // Note: temporaryPassword is NOT returned in response
            // It's only sent via email
          },
        },
        { status: 201 }
      );
    } catch (error) {
      // Ensure cleanup on any error
      if (createdUserId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        } catch (cleanupError) {
          console.error('Failed to cleanup auth user:', cleanupError);
        }
      }
      if (createdInstituteId) {
        try {
          await supabaseAdmin
            .from('institutes')
            .delete()
            .eq('id', createdInstituteId);
        } catch (cleanupError) {
          console.error('Failed to cleanup institute:', cleanupError);
        }
      }
      throw error;
    }
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

