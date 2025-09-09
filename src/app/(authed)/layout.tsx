import React from 'react';

import { getCachedAuthedUserOrRedirect } from '@/lib/auth/get-authed-user';

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await getCachedAuthedUserOrRedirect();

  return <>{children}</>;
}
