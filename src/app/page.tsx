import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect('/dashboard');
  return null; // The middleware will handle redirecting unauthenticated users to sign-in
}
