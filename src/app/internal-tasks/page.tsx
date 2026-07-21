import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function InternalTasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  // Redirect to department-specific tasks page — internal tasks
  // are already shown alongside project tasks in department views
  redirect(`/tasks/departments/${user.department}`);
}