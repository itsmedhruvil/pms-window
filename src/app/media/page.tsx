import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { MediaClient } from './MediaClient';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function MediaPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  return (
    <AppLayout>
      <MediaClient />
    </AppLayout>
  );
}