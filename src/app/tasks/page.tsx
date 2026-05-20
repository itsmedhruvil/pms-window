import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UserRole, DEPARTMENT_SEQUENCE } from '@/types';
import { getActiveDepartmentNames } from '@/lib/departments';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  const departments = await getActiveDepartmentNames();

  // Redirect admin to first department tasks, department users to their own
  const targetDept = isAdmin ? (departments[0] || DEPARTMENT_SEQUENCE[0]) : user.department;
  redirect(`/tasks/departments/${targetDept}`);
}
