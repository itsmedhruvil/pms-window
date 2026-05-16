import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import connectDB from '@/lib/db';
import UserModel from '@/models/User';
import { AppLayout } from '@/components/layout/AppLayout';
import { DiscussionsClient } from './DiscussionsClient';
import type { IUser } from '@/types';

export default async function DiscussionsPage() {
  const clerkUser = await currentUser();
  if (!clerkUser) redirect('/sign-in');

  let dbUser: Partial<IUser> | null = null;

  await connectDB();
  const user = await UserModel.findOne({ clerkId: clerkUser.id })
    .select('name email department role avatar')
    .lean();
  if (user) {
    dbUser = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      department: user.department,
      role: user.role,
    };
  }

  return (
    <AppLayout>
      <DiscussionsClient currentUser={dbUser || { name: 'Unknown' }} />
    </AppLayout>
  );
}