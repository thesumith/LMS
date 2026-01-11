'use client';

import { useState, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './login.module.css';

export default function LoginClient() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        const currentHostname = window.location.hostname;
        const port = window.location.port ? `:${window.location.port}` : '';
        const subdomain = String(data.redirect_subdomain);

        // If we're already on the correct tenant subdomain, don't prepend again.
        if (!currentHostname.startsWith(`${subdomain}.`)) {
          // Use NEXT_PUBLIC_MAIN_DOMAIN (recommended) to avoid double-subdomain like a.a.localhost
          const mainDomainEnv = (process.env.NEXT_PUBLIC_MAIN_DOMAIN || '').trim();
          const mainDomain = mainDomainEnv ? mainDomainEnv.split(':')[0] : '';

          let baseHost: string;
          if (
            mainDomain &&
            (currentHostname === mainDomain || currentHostname.endsWith(`.${mainDomain}`))
          ) {
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
        redirectUrl = redirectUrl.startsWith('/') ? redirectUrl : `/${redirectUrl}`;
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
    <div className={`dark ${styles.root}`}>
      <div
        className="bg-[#f6f6f8] dark:bg-[#131022] min-h-screen flex items-center justify-center p-4 digital-rain-overlay"
        data-alt="Abstract dark digital grid with subtle code patterns"
      >
        {/* Main Terminal Container */}
        <div className="layout-container flex h-full grow flex-col items-center justify-center w-full max-w-[1200px]">
          <div className="layout-content-container flex flex-col w-full max-w-[560px] bg-[#1d1c27]/80 backdrop-blur-md border border-[#3f3b54] rounded-xl overflow-hidden terminal-glow">
            {/* Terminal Header Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#121118] border-b border-[#3f3b54]">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
              </div>
              <div className="text-[#a19db9] text-xs font-mono tracking-widest uppercase">
                Secure Session: TLS_AES_256_GCM
              </div>
              <div className="w-12"></div>
            </div>

            {/* Page Heading Component */}
            <div className="flex flex-wrap justify-between gap-3 p-6 pt-8">
              <div className="flex min-w-72 flex-col gap-2">
                <p className="text-white text-3xl font-black leading-tight tracking-[-0.033em]">
                  root@tech-lms:~/login$ <span className="animate-pulse">_</span>
                </p>
                <p className="text-[#a19db9] text-sm font-normal leading-normal tracking-widest">
                  SYSTEM: READY | CONNECTION: ENCRYPTED
                </p>
              </div>
            </div>

            {/* Image/Hero Area */}
            <div className="px-6">
              <div className="py-3">
                <div
                  className="w-full bg-center bg-no-repeat bg-cover flex flex-col justify-end overflow-hidden bg-[#121118] rounded-lg min-h-40 border border-[#3f3b54]/50 relative"
                  data-alt="Monochrome close up of high tech computer circuit lines"
                  style={{
                    backgroundImage:
                      'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCK4MiHWLzL2TW-nUpJ3FKoVovkjRJhXdFdcI1XenoC5K5NP0VAWwCe09Ss0-1oubNpfXfP4QL0fiTgTihuLh7K0rfcKzh4WOhsIZqjnLY5V1Cji6Rd-ij2JKxLO6PPHn5TBf4UJmCQyDmhlLGf4vMMviKNh94L2uZP5rJEq56LNCJmAPe5oYmwe9UzxmZyHQSakDfjgL8uYqkBm5YKkH2TAszP9ZY6C2kmIFQ5BrjDpvT6rApRSYM0SKtGZn1lfUWMYLp6Rx7wPcg")',
                  }}
                >
                  <div className="absolute inset-0 bg-[#3713ec]/10 mix-blend-overlay"></div>
                  <div className="p-4 bg-gradient-to-t from-[#121118] to-transparent">
                    <span className="text-xs text-[#3713ec] font-bold tracking-tighter uppercase">
                      Authorized Personnel Only
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Form Fields */}
              <div className="flex flex-col gap-2 px-6 py-4">
                {error ? (
                  <div className="border border-red-500/30 bg-red-500/10 text-red-200 rounded-lg p-3 text-xs font-mono tracking-wide">
                    {error}
                  </div>
                ) : null}

                {/* TextField: User ID */}
                <div className="flex flex-wrap items-end gap-4 py-2">
                  <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-white text-xs font-bold leading-normal pb-2 tracking-[0.2em] uppercase opacity-70">
                      User_Identity
                    </p>
                    <div className="flex w-full flex-1 items-stretch rounded-lg group">
                      <input
                        className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-[#3713ec] border border-[#3f3b54] bg-[#121118] focus:border-[#3713ec] h-14 placeholder:text-[#3f3b54] p-[15px] rounded-r-none border-r-0 pr-2 text-base font-normal leading-normal transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="admin_dev_01"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        inputMode="email"
                        disabled={loading}
                        required
                      />
                      <div className="text-[#a19db9] flex border border-[#3f3b54] bg-[#121118] items-center justify-center pr-[15px] rounded-r-lg border-l-0 group-focus-within:border-[#3713ec] group-focus-within:text-[#3713ec] transition-all">
                        <span className="material-symbols-outlined">terminal</span>
                      </div>
                    </div>
                  </label>
                </div>

                {/* TextField: Password */}
                <div className="flex flex-wrap items-end gap-4 py-2">
                  <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-white text-xs font-bold leading-normal pb-2 tracking-[0.2em] uppercase opacity-70">
                      Encrypted_Access_Key
                    </p>
                    <div className="flex w-full flex-1 items-stretch rounded-lg group">
                      <input
                        className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-1 focus:ring-[#3713ec] border border-[#3f3b54] bg-[#121118] focus:border-[#3713ec] h-14 placeholder:text-[#3f3b54] p-[15px] rounded-r-none border-r-0 pr-2 text-base font-normal leading-normal transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="••••••••"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        disabled={loading}
                        required
                      />
                      <div className="text-[#a19db9] flex border border-[#3f3b54] bg-[#121118] items-center justify-center pr-[15px] rounded-r-lg border-l-0 group-focus-within:border-[#3713ec] group-focus-within:text-[#3713ec] transition-all">
                        <span className="material-symbols-outlined">key</span>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-4 px-6 pb-8 pt-2">
                {/* SingleButton: Login */}
                <div className="flex py-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="group flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-14 px-5 flex-1 bg-[#3713ec] text-white text-base font-bold leading-normal tracking-[0.1em] hover:bg-[#3713ec]/90 transition-all border border-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className="truncate flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">settings_power</span>
                      {loading ? '[ AUTHENTICATING… ]' : '[ EXECUTE_AUTH_SESSION ]'}
                    </span>
                  </button>
                </div>

                {/* Biometric Shortcut Placeholder */}
                <div className="flex items-center justify-center gap-6 pt-2">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-[#a19db9] hover:text-[#3713ec] transition-colors text-xs font-bold tracking-widest uppercase group"
                  >
                    <div className="p-2 border border-[#3f3b54] rounded-lg group-hover:border-[#3713ec] transition-all bg-[#121118]">
                      <span className="material-symbols-outlined">fingerprint</span>
                    </div>
                    Biometric_Scan
                  </button>
                  <div className="h-8 w-[1px] bg-[#3f3b54]"></div>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-[#a19db9] hover:text-[#3713ec] transition-colors text-xs font-bold tracking-widest uppercase group"
                  >
                    <div className="p-2 border border-[#3f3b54] rounded-lg group-hover:border-[#3713ec] transition-all bg-[#121118]">
                      <span className="material-symbols-outlined">face_unlock</span>
                    </div>
                    Retina_ID
                  </button>
                </div>

                {/* Footer Links */}
                <div className="flex justify-between items-center mt-6 text-[10px] font-mono text-[#3f3b54] border-t border-[#3f3b54] pt-4 uppercase tracking-tighter">
                  <a className="hover:text-[#a19db9]" href="#">
                    --help / recover_pass
                  </a>
                  <a className="hover:text-[#a19db9]" href="#">
                    mkdir -u / create_account
                  </a>
                  <span className="text-[#3f3b54]">v2.4.0-stable</span>
                </div>
              </div>
            </form>
          </div>

          {/* System Background Info */}
          <div className="mt-8 text-center max-w-md">
            <p className="text-[#3f3b54] text-[10px] font-mono leading-relaxed uppercase tracking-[0.2em]">
              Warning: This system is for authorized users only. All activity is logged and monitored under protocol
              88-ALPHA. unauthorized access attempts will be traced.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


