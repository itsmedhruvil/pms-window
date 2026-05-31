'use client';

import { useState } from 'react';
import { Plus, FolderPlus, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreateProjectForm } from '@/components/forms/CreateProjectForm';
import { CreateTaskForm } from '@/components/forms/CreateTaskForm';
import { Modal } from '@/components/ui/Modal';

const SECTIONS = [
  { id: 'project', label: 'Project', icon: FolderPlus },
  { id: 'task', label: 'Task', icon: ClipboardList },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export function GlobalCreateButton() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SectionId>('project');
  const closeAll = () => {
    setOpen(false);
    setSection('project');
  };

  return (
    <>
      <div className="fixed right-6 bottom-6 z-50">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full bg-black px-4 py-3 text-xs font-mono font-bold uppercase tracking-wide text-white shadow-2xl hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create
        </button>
      </div>

      <Modal open={open} onClose={closeAll} size="lg" className="max-w-[90vw] xl:max-w-[1000px]">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-mono uppercase text-gray-500">Global create</p>
              <h2 className="text-2xl font-black text-gray-900">Create project or task</h2>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <div className="space-y-2">
                {SECTIONS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSection(id)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors',
                      section === id
                        ? 'bg-black text-white'
                        : 'text-gray-700 hover:bg-white hover:border hover:border-gray-200'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-4">
              {section === 'project' && (
                <CreateProjectForm onSuccess={closeAll} onCancel={closeAll} />
              )}

              {section === 'task' && (
                <CreateTaskForm onSuccess={closeAll} onCancel={closeAll} />
              )}

            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
