/**
 * Institute API: Users Management
 * 
 * Endpoint for creating users (teachers/students) within an institute.
 * Only accessible to Institute Admin (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTenantApiContext } from '@/lib/api/context';
import { generateTemporaryPassword } from '@/lib/utils/password';
import { sendOnboardingEmail } from '@/lib/utils/email';
import {
  formatErrorResponse,
  ValidationError,
  ConflictError,
  InternalServerError,
} from '@/lib/errors/api-errors';

interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: 'TEACHER' | 'STUDENT';
  password?: string; // Optional - if not provided, generate temporary password
}

/**
 * POST /api/institute/users
 * 
 * Create a new user (teacher or student)
 * 
 * Requires: Institute Admin role
 * Enforced by: RLS policies
 */
export async function POST(request: NextRequest) {
  try {
    const { instituteId } = await requireTenantApiContext(request);

    // Parse request body
    const body: CreateUserRequest = await request.json();
    const { email, firstName, lastName, role, password } = body;

    // Validation
    if (!email?.trim()) {
      throw new ValidationError('Email is required');
    }
    if (!firstName?.trim()) {
      throw new ValidationError('First name is required');
    }
    if (!lastName?.trim()) {
      throw new ValidationError('Last name is required');
    }
    if (!role || (role !== 'TEACHER' && role !== 'STUDENT')) {
      throw new ValidationError('Role must be TEACHER or STUDENT');
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers.users.find((u) => u.email === normalizedEmail);

    if (existingUser) {
      // Check if profile exists in this institute
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, institute_id')
        .eq('id', existingUser.id)
        .is('deleted_at', null)
        .single();

      if (existingProfile) {
        throw new ConflictError('User with this email already exists');
      }
    }

    // Generate password if not provided
    const isTemporaryPassword = !password;
    const userPassword = password || generateTemporaryPassword();

    // Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: userPassword,
      email_confirm: true, // Auto-confirm email
    });

    if (authError || !authUser.user) {
      throw new InternalServerError(
        `Failed to create auth user: ${authError?.message}`
      );
    }

    const createdUserId = authUser.user.id;

    try {
      // Create profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: createdUserId,
          institute_id: instituteId,
          email: normalizedEmail,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          must_change_password: isTemporaryPassword,
          is_active: true,
        });

      if (profileError) {
        // Rollback: Delete auth user
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        throw new InternalServerError(
          `Failed to create profile: ${profileError.message}`
        );
      }

      // Assign role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: createdUserId,
          role_name: role,
          institute_id: instituteId,
        });

      if (roleError) {
        // Rollback: Delete profile and auth user
        await supabaseAdmin.from('profiles').delete().eq('id', createdUserId);
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        throw new InternalServerError(
          `Failed to assign role: ${roleError.message}`
        );
      }

      // Send onboarding email (async, non-blocking)
      if (isTemporaryPassword) {
        void (async () => {
          const { data: institute } = await supabaseAdmin
            .from('institutes')
            .select('name, subdomain')
            .eq('id', instituteId)
            .is('deleted_at', null)
            .single();

          if (!institute?.subdomain || !institute?.name) return;

          await sendOnboardingEmail({
            email: normalizedEmail,
            instituteName: institute.name,
            subdomain: institute.subdomain,
            temporaryPassword: userPassword,
            adminName: `${firstName.trim()} ${lastName.trim()}`,
          });
        })().catch((err) => {
          console.error('Failed to send onboarding email:', err);
          // Don't fail the request if email fails
        });
      }

      // Fetch created user data
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, email, first_name, last_name, is_active, created_at')
        .eq('id', createdUserId)
        .single();

      return NextResponse.json(
        {
          success: true,
          data: profile,
          message: isTemporaryPassword
            ? 'User created successfully. Temporary password sent via email.'
            : 'User created successfully.',
        },
        { status: 201 }
      );
    } catch (error) {
      // Cleanup on error
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      throw error;
    }
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

/**
 * GET /api/institute/users
 * 
 * List users in the institute
 * 
 * Requires: Institute Admin role (enforced by RLS)
 */
export async function GET(request: NextRequest) {
  try {
    const { instituteId } = await requireTenantApiContext(request);

    // Fetch profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, first_name, last_name, is_active, created_at')
      .eq('institute_id', instituteId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (profilesError) {
      throw new Error(`Failed to fetch users: ${profilesError.message}`);
    }

    // Fetch roles for all users
    const userIds = (profiles || []).map((p) => p.id);
    const { data: rolesData, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role_name')
      .in('user_id', userIds)
      .is('deleted_at', null);

    if (rolesError) {
      throw new Error(`Failed to fetch user roles: ${rolesError.message}`);
    }

    // Map roles to users
    const rolesMap = new Map<string, string[]>();
    (rolesData || []).forEach((ur: any) => {
      if (!rolesMap.has(ur.user_id)) {
        rolesMap.set(ur.user_id, []);
      }
      rolesMap.get(ur.user_id)!.push(ur.role_name);
    });

    // Combine profiles with roles
    const users = (profiles || []).map((profile: any) => ({
      ...profile,
      roles: rolesMap.get(profile.id) || [],
    }));

    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error) {
    const { statusCode, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

