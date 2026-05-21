import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { DiscussionsClient } from './DiscussionsClient';
import { serialize } from '@/lib/server-data';

export const dynamic = 'force-dynamic';

export default async function DiscussionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  return (
    <AppLayout>
      <DiscussionsClient currentUser={serialize(user) as unknown as Partial<import('@/types').IUser>} />
    </AppLayout>
  );
}