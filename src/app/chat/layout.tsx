import { requireAuthServer } from '@/lib/auth/require-auth-server';

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthServer();

  return <>{children}</>;
}
