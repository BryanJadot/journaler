import { redirect } from 'next/navigation';

import { requireAuthServer } from '@/lib/auth/require-auth-server';

export default async function HomePage() {
  await requireAuthServer();
  redirect('/chat');
}
