import { redirect } from 'next/navigation';

// Department management now lives inside Settings.
export default function DepartmentsPage() {
  redirect('/settings');
}