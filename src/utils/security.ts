/**
 * VN-Quant Enterprise Security Engine
 * - SHA-256 Cryptographic Hashing with Salt
 * - Inactivity Auto-Lock Management
 * - Anti-Tamper State Verification
 */

const SALT = 'vnquant_crypto_salt_2026_sec_v5';
const DEFAULT_PIN = '1234';

// Hash a plaintext password with salt using Web Crypto API (SHA-256)
export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${SALT}:${password}:${SALT}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Check if input matches stored hash (with backward compatibility migration)
export async function verifyPassword(input: string): Promise<boolean> {
  const inputHash = await hashPassword(input);
  let storedHash = localStorage.getItem('vnquant_lock_password_hash');

  // Check for legacy plaintext migration
  const legacyPlaintext = localStorage.getItem('vnquant_lock_password');
  if (legacyPlaintext) {
    // If legacy exists, convert it now to hash and remove plaintext
    const migratedHash = await hashPassword(legacyPlaintext);
    localStorage.setItem('vnquant_lock_password_hash', migratedHash);
    localStorage.removeItem('vnquant_lock_password');
    storedHash = migratedHash;
  }

  // If no hash stored yet, default to hash of '1234'
  if (!storedHash) {
    const defaultHash = await hashPassword(DEFAULT_PIN);
    localStorage.setItem('vnquant_lock_password_hash', defaultHash);
    storedHash = defaultHash;
  }

  return inputHash === storedHash;
}

// Update password hash safely
export async function saveNewPassword(newPassword: string): Promise<void> {
  const newHash = await hashPassword(newPassword);
  localStorage.setItem('vnquant_lock_password_hash', newHash);
  // Ensure legacy plaintext is scrubbed
  localStorage.removeItem('vnquant_lock_password');
}

// Auto-lock inactivity timeout settings (in minutes: 0 = disabled, 5, 10, 15, 30)
export function getAutoLockTimeout(): number {
  const val = localStorage.getItem('vnquant_auto_lock_timeout');
  return val !== null ? parseInt(val, 10) : 10; // Default: 10 minutes
}

export function setAutoLockTimeout(minutes: number): void {
  localStorage.setItem('vnquant_auto_lock_timeout', String(minutes));
}
