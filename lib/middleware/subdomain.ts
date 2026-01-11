/**
 * Subdomain Parsing Utilities
 * 
 * Extracts and validates subdomain from request host.
 * Handles localhost, production domains, and custom domains.
 */

export interface SubdomainInfo {
  subdomain: string | null;
  domain: string;
  isMainDomain: boolean;
}

/**
 * Extract subdomain from request host
 * 
 * Examples:
 * - "institute1.platform.com" → { subdomain: "institute1", domain: "platform.com", isMainDomain: false }
 * - "platform.com" → { subdomain: null, domain: "platform.com", isMainDomain: true }
 * - "localhost:3000" → { subdomain: null, domain: "localhost:3000", isMainDomain: true }
 * - "institute1.localhost:3000" → { subdomain: "institute1", domain: "localhost:3000", isMainDomain: false }
 */
export function extractSubdomain(host: string): SubdomainInfo {
  // Remove port if present
  const hostWithoutPort = host.split(':')[0];
  
  // Handle localhost for development
  if (hostWithoutPort === 'localhost' || hostWithoutPort === '127.0.0.1') {
    return {
      subdomain: null,
      domain: host,
      isMainDomain: true,
    };
  }

  // Handle localhost subdomains for development (e.g. tenant.localhost:3000)
  // NOTE: Browsers may not share cookies across *.localhost, but routing must still be correct.
  if (hostWithoutPort.endsWith('.localhost')) {
    const parts = hostWithoutPort.split('.');
    // hostWithoutPort is guaranteed to have at least 2 parts here.
    const subdomainParts = parts.slice(0, -1); // everything before "localhost"
    const subdomain = subdomainParts.join('.');

    if (!subdomain) {
      return {
        subdomain: null,
        domain: host,
        isMainDomain: true,
      };
    }

    // Preserve port (if any) in the domain by stripping just the left-most label from the original host.
    // e.g. "school.localhost:3000" -> "localhost:3000"
    const dotIdx = host.indexOf('.');
    const domainWithPort = dotIdx >= 0 ? host.substring(dotIdx + 1) : host;

    return {
      subdomain,
      domain: domainWithPort,
      isMainDomain: false,
    };
  }
  
  // Split by dots
  const parts = hostWithoutPort.split('.');
  
  // If less than 2 parts, it's the main domain (e.g., "localhost", "example")
  if (parts.length < 2) {
    return {
      subdomain: null,
      domain: host,
      isMainDomain: true,
    };
  }
  
  // Get main domain (last 2 parts for .com, .org, etc., or last 3 for .co.uk, etc.)
  // For simplicity, assume last 2 parts are the main domain
  // Adjust based on your actual domain structure
  const mainDomainParts = parts.slice(-2);
  const mainDomain = mainDomainParts.join('.');
  
  // Everything before the main domain is the subdomain
  const subdomainParts = parts.slice(0, -2);
  
  if (subdomainParts.length === 0) {
    return {
      subdomain: null,
      domain: host,
      isMainDomain: true,
    };
  }
  
  const subdomain = subdomainParts.join('.');
  
  return {
    subdomain,
    domain: mainDomain,
    isMainDomain: false,
  };
}

/**
 * Get main domain from environment or default
 * Used to determine if request is for main platform vs tenant subdomain
 */
export function getMainDomain(): string {
  // Get from environment variable or use default
  const envDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN;
  if (envDomain) {
    return envDomain;
  }
  
  // Fallback: extract from NEXT_PUBLIC_APP_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const url = new URL(appUrl);
      return url.hostname;
    } catch {
      // Invalid URL, use default
    }
  }
  
  return 'localhost';
}

/**
 * Check if subdomain is reserved (cannot be used by tenants)
 */
export function isReservedSubdomain(subdomain: string): boolean {
  const reserved = [
    'www',
    'api',
    'admin',
    'app',
    'dashboard',
    'mail',
    'email',
    'ftp',
    'localhost',
    'staging',
    'dev',
    // 'test' removed - can be used as institute subdomain
    'demo',
    'support',
    'help',
    'docs',
    'blog',
    'status',
  ];
  
  return reserved.includes(subdomain.toLowerCase());
}

