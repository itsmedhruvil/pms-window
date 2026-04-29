'use client';

import { useEffect, useState } from 'react';
import { Plus, FolderPlus, ClipboardList, AlertTriangle, X } from 'lucide-react';
import { apiFetch, cn } from '@/lib/utils';
import { CreateProjectForm } from '@/components/forms/CreateProjectForm';
import { CreateTaskForm } from '@/components/forms/CreateTaskForm';
import { CreateAlertForm } from '@/components/forms/CreateAlertForm';
import { Modal } from '@/components/ui/Modal';
import type { IProject } from '@/types';

const SECTIONS = [
  { id: 'project', label: 'Project', icon: FolderPlus },
  { id: 'task', label: 'Task', icon: ClipboardList },
  { id: 'alert', label: 'Alert', icon: AlertTriangle },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export function GlobalCreateButton() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SectionId>('project');
  const [projects, setProjects] = useState<IProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [selectedAlertProject, setSelectedAlertProject] = useState<string>('');

  useEffect(() => {
    if (!open || section !== 'alert') return;
    if (projects.length > 0) return;

    let mounted = true;
    setLoadingProjects(true);
    setProjectError(null);

    apiFetch<{ items: IProject[] }>('/api/projects?limit=100')
      .then((result) => {
        if (!mounted) return;
        setLoadingProjects(false);

        if (!result.success) {
          setProjectError(result.error || 'Failed to load projects');
          return;
        }

        const nextProjects = result.data?.items || [];
        setProjects(nextProjects);
        setSelectedAlertProject(nextProjects[0]?._id || '');
      })
      .catch(() => {
        if (!mounted) return;
        setLoadingProjects(false);
        setProjectError('Failed to load projects');
      });

    return () => {
      mounted = false;
    };
  }, [open, section, projects.length]);

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
              <h2 className="text-2xl font-black text-gray-900">Create project, task or alert</h2>
            </div>
            <button
              type="button"
              onClick={closeAll}
              className="text-gray-500 hover:text-gray-900"
            >
              <X className="w-5 h-5" />
            </button>
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

              {section === 'alert' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-gray-900">Raise an Alert</h3>
                      <p className="text-xs text-gray-500 font-mono">Choose a project and create a new alert.</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-[11px] uppercase tracking-[0.2em] text-gray-500 font-bold">
                      Project
                      <select
                        value={selectedAlertProject}
                        onChange={(e) => setSelectedAlertProject(e.target.value)}
                        className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black"
                      >
                        {projects.map((project) => (
                          <option key={project._id} value={project._id}>
                            {project.projectTitle}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {loadingProjects && (
                    <p className="text-xs text-gray-500">Loading projects…</p>
                  )}
                  {projectError && (
                    <p className="text-xs text-red-600">{projectError}</p>
                  )}

                  {selectedAlertProject ? (
                    <CreateAlertForm
                      projectId={selectedAlertProject}
                      projectTitle={
                        projects.find((project) => project._id === selectedAlertProject)
                          ? `${projects.find((project) => project._id === selectedAlertProject)?.clientName} — ${projects.find((project) => project._id === selectedAlertProject)?.projectTitle}`
                          : 'Selected project'
                      }
                      onSuccess={closeAll}
                      onCancel={closeAll}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
                      No project selected. Create at least one project first.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
