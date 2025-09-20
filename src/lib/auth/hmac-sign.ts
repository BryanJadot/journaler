import { getHmacSecret } from '@/lib/auth/hmac-secret';
import type { HmacSignatureData } from '@/lib/auth/hmac-types';

/**
 * Creates an HMAC signature for authentication.
 * Used by both middleware (user sessions) and internal service calls.
 */
export async function createHmacSignature(
  data: HmacSignatureData
): Promise<string> {
  const secret = getHmacSecret();
  if (!secret) {
    throw new Error('INTERNAL_HEADER_SECRET environment variable is required');
  }

  // Create message with pipe separators to prevent collision attacks
  const message = `${data.userId}|${data.method}|${data.path}|${data.timestamp}`;
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);

  // Import secret key for HMAC-SHA256 signing (Edge runtime Web Crypto API)
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, messageBytes);

  // Convert to base64url encoding (URL-safe base64)
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
