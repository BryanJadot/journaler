import { redirect } from 'next/navigation';
import { cache } from 'react';

import { getAuthToken } from '@/lib/auth/cookies';
import { verifyAuthToken } from '@/lib/auth/jwt';

/**
 * Gets the authenticated user's ID or redirects to login.
 * This function is cached per request, so multiple calls within
 * the same request will return the same value without re-executing.
 *
 * Can be called from any component (pages, layouts, server actions)
 * to get the authenticated user ID or automatically redirect to login.
 */
export const getCachedAuthedUserOrRedirect = cache(
  async (): Promise<string> => {
    const token = await getAuthToken();

    if (!token) {
      redirect('/login');
    }

    const verificationResult = await verifyAuthToken(token);

    if (!verificationResult.success) {
      redirect('/login');
    }

    return verificationResult.payload.userId;
  }
);
