/**
 * API Request Context Helpers
 *
 * Why this exists:
 * - Next.js middleware is NOT guaranteed to run for `/api` routes in this repo (by design).
 * - Many route handlers need institute + user context and previously relied on middleware-injected headers.
 * - These helpers derive institute context from the Host (subdomain) and user context from Supabase auth cookies.
 */

import type { NextRequest } from 'next/server';
import { UnauthorizedError } from '@/lib/errors/api-errors';
import { extractAccessToken } from '@/lib/middleware/token';
import { validateSession, belongsToInstitute, isSuperAdmin, type UserSession } from '@/lib/middleware/auth';
import { extractSubdomain, isReservedSubdomain } from '@/lib/middleware/subdomain';
import { getInstituteBySubdomain } from '@/lib/middleware/institute';

export interface ApiInstituteContext {
  instituteId: string;
  instituteSubdomain: string;
}

export async function getApiSessionFromRequest(request: NextRequest): Promise<UserSession | null> {
  const accessToken = extractAccessToken(request);
  return accessToken ? await validateSession(accessToken) : null;
}

export async function requireApiSession(request: NextRequest): Promise<UserSession> {
  const session = await getApiSessionFromRequest(request);
  if (!session) {
    throw new UnauthorizedError('Authentication required');
  }
  return session;
}

export async function requireInstituteContext(request: NextRequest): Promise<ApiInstituteContext> {
  const host = request.headers.get('host') || '';
  const subdomainInfo = extractSubdomain(host);

  if (subdomainInfo.isMainDomain || !subdomainInfo.subdomain) {
    throw new UnauthorizedError('Institute context required');
  }

  if (isReservedSubdomain(subdomainInfo.subdomain)) {
    throw new UnauthorizedError('Institute context required');
  }

  const institute = await getInstituteBySubdomain(subdomainInfo.subdomain);
  if (!institute) {
    throw new UnauthorizedError('Institute context required');
  }

  return {
    instituteId: institute.id,
    instituteSubdomain: subdomainInfo.subdomain,
  };
}

/**
 * Convenience helper for tenant-scoped API routes.
 * Ensures:
 * - user is authenticated
 * - institute can be resolved from Host subdomain
 * - non-super-admin belongs to the institute
 */
export async function requireTenantApiContext(
  request: NextRequest
): Promise<{ session: UserSession } & ApiInstituteContext> {
  const [session, institute] = await Promise.all([
    requireApiSession(request),
    requireInstituteContext(request),
  ]);

  if (!isSuperAdmin(session) && !belongsToInstitute(session, institute.instituteId)) {
    throw new UnauthorizedError('Institute access required');
  }

  return { session, ...institute };
}


