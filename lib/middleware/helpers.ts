/**
 * Middleware Helper Functions
 * 
 * Utility functions for extracting context from request headers
 * (set by middleware for use in server components and API routes)
 */

import { headers } from 'next/headers';

/**
 * Get institute ID from request headers (set by middleware)
 */
export async function getInstituteIdFromHeaders(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get('x-institute-id');
}

/**
 * Get institute subdomain from request headers (set by middleware)
 */
export async function getInstituteSubdomainFromHeaders(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get('x-institute-subdomain');
}

/**
 * Get user ID from request headers (set by middleware)
 */
export async function getUserIdFromHeaders(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get('x-user-id');
}

/**
 * Get user roles from request headers (set by middleware)
 */
export async function getUserRolesFromHeaders(): Promise<string[]> {
  const headersList = await headers();
  const rolesHeader = headersList.get('x-user-roles');
  return rolesHeader ? rolesHeader.split(',') : [];
}

/**
 * Get all middleware context from headers
 */
export async function getMiddlewareContext(): Promise<{
  instituteId: string | null;
  subdomain: string | null;
  userId: string | null;
  roles: string[];
}> {
  const headersList = await headers();
  
  return {
    instituteId: headersList.get('x-institute-id'),
    subdomain: headersList.get('x-institute-subdomain'),
    userId: headersList.get('x-user-id'),
    roles: headersList.get('x-user-roles')?.split(',') || [],
  };
}

