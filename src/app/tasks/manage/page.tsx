import { Suspense } from 'react';
import TaskManagementClient from '@/components/TaskManagementClient';
import { PageLoader } from '@/components/ui/spinner';

export default function TaskManagementPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Task Management</h1>
      <Suspense fallback={<PageLoader label="Loading tasks" />}>
        <TaskManagementClient />
      </Suspense>
    </div>
  );
}