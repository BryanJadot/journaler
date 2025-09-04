import { redirect } from 'next/navigation';
import { getAuthToken } from './cookies';
import { verifyAuthToken } from './jwt';

export async function requireAuthServer(): Promise<string> {
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
