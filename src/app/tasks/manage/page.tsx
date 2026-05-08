import { Suspense } from 'react';
import TaskManagementClient from '@/components/TaskManagementClient';

export default function TaskManagementPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Task Management</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <TaskManagementClient />
      </Suspense>
    </div>
  );
}