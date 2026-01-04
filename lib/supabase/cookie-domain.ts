import { getMainDomain } from '@/lib/middleware/subdomain';

/**
 * Returns a cookie domain that shares auth cookies across subdomains.
 *
 * Production example:
 * - NEXT_PUBLIC_MAIN_DOMAIN=platform.com  -> ".platform.com"
 *
 * Dev note:
 * - Browsers do NOT reliably support setting Domain=.localhost
 * - Use a real dev domain that supports subdomains (e.g. lvh.me) and set:
 *   NEXT_PUBLIC_MAIN_DOMAIN=lvh.me -> ".lvh.me"
 */
export function getAuthCookieDomain(): string | undefined {
  const raw = (getMainDomain() || '').trim();
  const host = raw.split(':')[0]; // strip port if present

  if (!host) return undefined;
  if (host === 'localhost' || host === '127.0.0.1') return undefined;

  return host.startsWith('.') ? host : `.${host}`;
}


