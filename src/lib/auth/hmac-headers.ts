import {
  HEADER_PREFIXES,
  type HeaderPrefix,
  type HmacAuthHeaders,
} from '@/lib/auth/hmac-types';

/**
 * Utilities for manipulating HMAC authentication headers.
 */

/**
 * Sets HMAC authentication headers with the specified prefix.
 */
export function setHmacHeaders(
  headers: Headers,
  auth: HmacAuthHeaders,
  prefix: HeaderPrefix
): void {
  headers.set(`${prefix}-user`, auth.userId);
  headers.set(`${prefix}-ts`, auth.timestamp.toString());
  headers.set(`${prefix}-sig`, auth.signature);
  headers.set(`${prefix}-method`, auth.method);
  headers.set(`${prefix}-path`, auth.path);
}

/**
 * Extracts HMAC authentication data from headers.
 */
export function extractHmacHeaders(
  headers: Headers,
  prefix: HeaderPrefix
): HmacAuthHeaders | null {
  const userId = headers.get(`${prefix}-user`);
  const timestamp = headers.get(`${prefix}-ts`);
  const signature = headers.get(`${prefix}-sig`);
  const method = headers.get(`${prefix}-method`);
  const path = headers.get(`${prefix}-path`);

  if (!userId || !timestamp || !signature || !method || !path) {
    return null;
  }

  return {
    userId,
    method,
    path,
    timestamp: parseInt(timestamp, 10),
    signature,
  };
}

/**
 * Strips all internal headers from request headers.
 * Used to prevent header injection attacks.
 */
export function stripInternalHeaders(headers: Headers): void {
  const headersToDelete = [];
  // Collect headers to delete (cannot modify during iteration)
  for (const [name] of headers.entries()) {
    const lowerName = name.toLowerCase();
    if (HEADER_PREFIXES.some((prefix) => lowerName.startsWith(`${prefix}-`))) {
      headersToDelete.push(name);
    }
  }
  // Remove all potentially malicious internal headers
  for (const name of headersToDelete) {
    headers.delete(name);
  }
}
