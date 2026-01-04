/**
 * Password Generation Utilities
 * 
 * Generates secure, random temporary passwords for new users.
 * Passwords are never stored in plain text - only sent via email.
 */

/**
 * Generate a secure temporary password
 * 
 * Format: 12 characters with mix of uppercase, lowercase, numbers
 * Example: "Ab3xY9mK2pQ7"
 */
export function generateTemporaryPassword(): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude I, O for clarity
  const lowercase = 'abcdefghijkmnpqrstuvwxyz'; // Exclude l, o for clarity
  const numbers = '23456789'; // Exclude 0, 1 for clarity

  const allChars = uppercase + lowercase + numbers;
  
  let password = '';
  
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

/**
 * Validate subdomain format
 * 
 * Rules:
 * - 3-63 characters
 * - Only lowercase letters, numbers, and hyphens
 * - Cannot start or end with hyphen
 * - Cannot contain consecutive hyphens
 */
export function validateSubdomain(subdomain: string): boolean {
  if (subdomain.length < 3 || subdomain.length > 63) {
    return false;
  }

  // Must start and end with alphanumeric
  if (!/^[a-z0-9]/.test(subdomain) || !/[a-z0-9]$/.test(subdomain)) {
    return false;
  }

  // Only lowercase letters, numbers, and hyphens
  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    return false;
  }

  // No consecutive hyphens
  if (subdomain.includes('--')) {
    return false;
  }

  return true;
}

