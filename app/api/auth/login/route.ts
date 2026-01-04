/**
 * Login API Route
 * 
 * Handles user authentication via Supabase Auth.
 * Returns session token and redirect URL based on user role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getDashboardUrl } from '@/lib/auth/get-dashboard-url';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey,
      });
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Create Supabase client for authentication
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
    });

    // Authenticate user
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      // Don't reveal if email exists or not (security best practice)
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Get user profile and roles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        institute_id,
        must_change_password,
        email
      `)
      .eq('id', authData.user.id)
      .is('deleted_at', null)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Get user roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select(`
        roles!inner(name)
      `)
      .eq('user_id', authData.user.id)
      .is('deleted_at', null);

    if (rolesError) {
      return NextResponse.json(
        { error: 'Failed to fetch user roles' },
        { status: 500 }
      );
    }

    const roleNames = roles?.map((r: any) => r.roles.name) || [];

    if (roleNames.length === 0) {
      return NextResponse.json(
        { error: 'User has no assigned roles' },
        { status: 403 }
      );
    }

    // Determine redirect URL
    // If user must change password, redirect to change-password page
    // Otherwise, redirect to their role-appropriate dashboard
    let redirectUrl = '/';
    
    if (profile.must_change_password) {
      redirectUrl = '/change-password';
    } else {
      redirectUrl = getDashboardUrl(roleNames);
    }

    // Return session data
    return NextResponse.json({
      success: true,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
        expires_in: authData.session.expires_in,
      },
      user: {
        id: authData.user.id,
        email: profile.email,
        roles: roleNames,
        institute_id: profile.institute_id,
        must_change_password: profile.must_change_password,
      },
      redirect_url: redirectUrl,
    });
  } catch (error) {
    console.error('Login error:', error);
    
    // Provide more detailed error in development
    const errorMessage = process.env.NODE_ENV === 'development'
      ? error instanceof Error ? error.message : 'An unexpected error occurred'
      : 'An unexpected error occurred';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

