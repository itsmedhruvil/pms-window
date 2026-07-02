'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Plus, Copy, Edit, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { CreateTaskForm } from '@/components/forms/CreateTaskForm';
import { Department, ITask } from '@/types';

const DEPARTMENTS: Department[] = [
  Department.PRODUCTION,
  Department.PURCHASE,
  Department.OPERATIONS,
  Department.ACCOUNTS,
  Department.STORE,
  Department.SITE,
];

export default function TaskManagementClient() {
  const { user } = useUser();
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ITask | null>(null);

  useEffect(() => {
    if (selectedDepartment) {
      fetchTasksForDepartment(selectedDepartment);
    }
  }, [selectedDepartment]);

  const fetchTasksForDepartment = async (department: Department) => {
    try {
      const response = await fetch(`/api/tasks?department=${department}`);
      const data = await response.json();
      if (data.success) {
        setTasks(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const handleDuplicateTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/duplicate`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        fetchTasksForDepartment(selectedDepartment!);
      }
    } catch (error) {
      console.error('Failed to duplicate task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchTasksForDepartment(selectedDepartment!);
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleTaskCreated = () => {
    setIsCreateModalOpen(false);
    if (selectedDepartment) {
      fetchTasksForDepartment(selectedDepartment);
    }
  };

  const handleTaskUpdated = () => {
    setEditingTask(null);
    if (selectedDepartment) {
      fetchTasksForDepartment(selectedDepartment);
    }
  };

  if (!user) return <div>Please sign in</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {DEPARTMENTS.map((dept) => (
          <div
            key={dept}
            className={`cursor-pointer border rounded p-4 transition-colors ${
              selectedDepartment === dept ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-primary-50'
            }`}
            onClick={() => setSelectedDepartment(dept)}
          >
            <h3 className="font-semibold">{dept}</h3>
            <p className="text-sm text-dark-400">
              {tasks.filter(t => t.department === dept).length} tasks
            </p>
          </div>
        ))}
      </div>

      {selectedDepartment && (
        <div className="border rounded p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">{selectedDepartment} Tasks</h2>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-dark-500 text-white rounded text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          </div>
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task._id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <h3 className="font-medium">{task.title}</h3>
                  <p className="text-sm text-dark-400">{task.description}</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleDuplicateTask(task._id)}
                    className="p-2 border rounded hover:bg-primary-50"
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingTask(task)}
                    className="p-2 border rounded hover:bg-primary-50"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task._id)}
                    className="p-2 border rounded hover:bg-red-50 text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
        <CreateTaskForm
          department={selectedDepartment || undefined}
          onSuccess={handleTaskCreated}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      <Modal open={!!editingTask} onClose={() => setEditingTask(null)}>
        {editingTask && (
          <CreateTaskForm
            task={editingTask}
            onSuccess={handleTaskUpdated}
            onCancel={() => setEditingTask(null)}
          />
        )}
      </Modal>
    </div>
  );
}