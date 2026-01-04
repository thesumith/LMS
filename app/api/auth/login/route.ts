/**
 * Login API Route
 * 
 * Handles user authentication via Supabase Auth.
 * Returns session token and redirect URL based on user role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getDashboardUrl } from '@/lib/auth/get-dashboard-url';
import { cookies } from 'next/headers';

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

    // Create Supabase server client with cookie handling
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Cookie setting can fail in some contexts, but we'll continue
          }
        },
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

    // Set the session using the server client (this will set cookies properly)
    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
    });

    if (setSessionError) {
      console.error('Error setting session:', setSessionError);
      return NextResponse.json(
        { error: 'Failed to establish session' },
        { status: 500 }
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

    // Create response with session data
    const response = NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: profile.email,
        roles: roleNames,
        institute_id: profile.institute_id,
        must_change_password: profile.must_change_password,
      },
      redirect_url: redirectUrl,
    });

    // Get all cookies that were set by setSession() and copy them to the response
    // This ensures session cookies are included in the response
    const allCookies = cookieStore.getAll();
    allCookies.forEach((cookie) => {
      const isAuthCookie = cookie.name.includes('auth-token');
      response.cookies.set(
        cookie.name,
        cookie.value,
        {
          httpOnly: isAuthCookie,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax' as const,
          path: '/',
          ...(isAuthCookie ? { maxAge: 60 * 60 * 24 * 7 } : {}),
        }
      );
    });
    
    return response;
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

