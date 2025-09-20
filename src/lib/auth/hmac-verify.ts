import { getHmacSecret } from '@/lib/auth/hmac-secret';
import type { HmacSignatureData } from '@/lib/auth/hmac-types';

// Maximum age for timestamps (120 seconds) - prevents replay attacks
const MAX_TIMESTAMP_AGE = 120;

/**
 * Verifies HMAC signature using Web Crypto API for universal compatibility.
 *
 * This function recomputes the HMAC signature using the same algorithm as
 * createHmacSignature and performs timing-safe comparison to prevent timing attacks.
 *
 * @param data - The signature data to verify
 * @param receivedSignature - The signature to verify against
 * @returns True if signature is valid and timestamp is not too old
 */
export async function verifyHmacSignature(
  data: HmacSignatureData,
  receivedSignature: string
): Promise<boolean> {
  const secret = getHmacSecret();
  if (!secret) {
    throw new Error('INTERNAL_HEADER_SECRET environment variable is required');
  }

  // Check timestamp age to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  const age = now - data.timestamp;
  if (age > MAX_TIMESTAMP_AGE || age < -MAX_TIMESTAMP_AGE) {
    console.warn(`HMAC timestamp too old or in future: ${age}s`);
    return false;
  }

  // Recompute the expected signature using identical message format
  const message = `${data.userId}|${data.method}|${data.path}|${data.timestamp}`;
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);

  // Import secret key for HMAC-SHA256 verification
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, messageBytes);

  // Convert to base64url encoding to match createHmacSignature
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const expectedSignature = base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // SECURITY CRITICAL: Use constant-time comparison to prevent timing attacks
  // crypto.subtle.verify performs timing-safe comparison internally
  try {
    // Convert both signatures to Uint8Array for timing-safe comparison
    const receivedBytes = new TextEncoder().encode(receivedSignature);
    const expectedBytes = new TextEncoder().encode(expectedSignature);

    // Simple length check first (still timing-safe for different lengths)
    if (receivedBytes.length !== expectedBytes.length) {
      return false;
    }

    // Use manual XOR comparison for timing safety
    let result = 0;
    for (let i = 0; i < receivedBytes.length; i++) {
      result |= receivedBytes[i] ^ expectedBytes[i];
    }

    return result === 0;
  } catch (error) {
    console.error('HMAC signature verification failed:', error);
    return false;
  }
}
