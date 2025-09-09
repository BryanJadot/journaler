import { redirect } from 'next/navigation';
import { cache } from 'react';

import { getAuthToken } from '@/lib/auth/cookies';
import { verifyAuthToken } from '@/lib/auth/jwt';

/**
 * Gets the authenticated user's ID or redirects to login.
 * This function is cached per request, so multiple calls within
 * the same request will return the same value without re-executing.
 *
 * Called initially in the (authed) layout to enforce authentication,
 * then can be called in any page to get the cached userId.
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
