/**
 * Login Page
 * 
 * Client component for user authentication.
 * Works for all user roles (SUPER_ADMIN, INSTITUTE_ADMIN, TEACHER, STUDENT).
 * 
 * Features:
 * - Clean, professional design inspired by Coursera
 * - Minimal and elegant UI
 * - Smooth transitions and interactions
 * - Password visibility toggle
 * - Accessible and responsive
 */

'use client';

import { useState, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Call login API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Session cookies are set in the API response headers
      // Redirect immediately - cookies will be available on the next request
      let redirectUrl = redirect || data.redirect_url || '/';
      
      // If subdomain is provided, construct full URL with subdomain
      // This is needed when user logs in on main domain but needs to land on tenant subdomain.
      if (data.redirect_subdomain) {
        const protocol = window.location.protocol;
        const currentHost = window.location.host; // may already include a subdomain
        const currentHostname = window.location.hostname;
        const port = window.location.port ? `:${window.location.port}` : '';
        const subdomain = String(data.redirect_subdomain);

        // If we're already on the correct tenant subdomain, don't prepend again.
        if (!currentHostname.startsWith(`${subdomain}.`)) {
          // Use NEXT_PUBLIC_MAIN_DOMAIN (recommended) to avoid double-subdomain like a.a.localhost
          const mainDomainEnv = (process.env.NEXT_PUBLIC_MAIN_DOMAIN || '').trim();
          const mainDomain = mainDomainEnv ? mainDomainEnv.split(':')[0] : '';

          let baseHost: string;
          if (mainDomain && (currentHostname === mainDomain || currentHostname.endsWith(`.${mainDomain}`))) {
            baseHost = `${mainDomain}${port}`;
          } else {
            // Fallback: strip the left-most label from hostname (tenant) and keep the rest.
            // e.g. askpoint.localhost -> localhost, school.platform.com -> platform.com
            const parts = currentHostname.split('.');
            const baseHostname = parts.length > 1 ? parts.slice(1).join('.') : currentHostname;
            baseHost = `${baseHostname}${port}`;
          }

          redirectUrl = `${protocol}//${subdomain}.${baseHost}${redirectUrl}`;
        } else {
          // Ensure redirect URL is a relative path starting with /
          redirectUrl = redirectUrl.startsWith('/') ? redirectUrl : `/${redirectUrl}`;
        }
      } else {
        // Ensure redirect URL is a relative path starting with /
        redirectUrl = redirectUrl.startsWith('/') 
          ? redirectUrl 
          : `/${redirectUrl}`;
      }
      
      // Use window.location.href for full page reload to ensure cookies are sent
      // This is necessary because cookies are set in the API response
      window.location.href = redirectUrl;
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-lg mb-4">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-1">
            Krrch LMS
          </h1>
          <p className="text-gray-600 text-sm">Learning Management System</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">
              Sign in
          </h2>
            <p className="text-gray-600 text-sm">
              Enter your credentials to access your account
          </p>
        </div>
        
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Error Message */}
          {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-4">
                <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className={`h-5 w-5 transition-colors duration-200 ${
                      focusedField === 'email' ? 'text-blue-600' : 'text-gray-400'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                    />
                  </svg>
                </div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed sm:text-sm"
                  placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                disabled={loading}
              />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className={`h-5 w-5 transition-colors duration-200 ${
                      focusedField === 'password' ? 'text-blue-600' : 'text-gray-400'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
              <input
                id="password"
                name="password"
                  type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed sm:text-sm"
                  placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                disabled={loading}
              />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? (
                    <svg
                      className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
          </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md text-white text-sm font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>

            {/* Footer Note */}
            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <span className="text-blue-600 font-medium">
                  Contact your administrator
                </span>
            </p>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
