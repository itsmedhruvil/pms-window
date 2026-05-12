'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Hash,
  Image as ImageIcon,
  Loader2,
  Lock,
  PlayCircle,
  RotateCcw,
  Upload,
  User,
  X,
} from 'lucide-react';
import { CommentThread } from '@/components/comment/CommentThread';
import { CreateAlertForm } from '@/components/forms/CreateAlertForm';
import { Modal } from '@/components/ui/Modal';
import { TaskStatusBadge } from '@/components/ui/badges';
import { apiFetch, cn, DEPARTMENT_LABELS, formatDate, formatDateTime } from '@/lib/utils';
import { IProject, ITask, IUser, TaskImageAttachment, TaskStatus } from '@/types';

interface TaskDetailClientProps {
  initialTask: ITask;
  currentUser: Partial<IUser>;
  canModify: boolean;
}

const MAX_IMAGE_SIZE = 2_500_000;
const MAX_IMAGES = 6;

function getProject(task: ITask) {
  return typeof task.projectId === 'object' && task.projectId !== null
    ? (task.projectId as IProject)
    : null;
}

function getProjectId(task: ITask) {
  const project = getProject(task);
  return project?._id ?? (task.projectId as string);
}

function getAssignedUser(task: ITask) {
  return typeof task.assignedUser === 'object' && task.assignedUser !== null
    ? (task.assignedUser as IUser)
    : null;
}

export function TaskDetailClient({ initialTask, currentUser, canModify }: TaskDetailClientProps) {
  const [task, setTask] = useState(initialTask);
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const project = getProject(task);
  const projectId = getProjectId(task);
  const assignedUser = getAssignedUser(task);
  const images = task.imageAttachments ?? [];

  const updateTask = async (patch: Partial<ITask>) => {
    setSaving(true);
    setStatusError(null);
    const result = await apiFetch<ITask>(`/api/tasks/${task._id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    setSaving(false);

    if (result.success && result.data) {
      setTask(result.data);
      router.refresh();
    } else if (patch.status) {
      setStatusError(typeof result.error === 'string' ? result.error : 'Could not update task status.');
    }
  };

  const handleImagesSelected = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadError(null);

    const existing = task.imageAttachments ?? [];
    const availableSlots = MAX_IMAGES - existing.length;
    const selected = Array.from(files).slice(0, Math.max(availableSlots, 0));

    if (availableSlots <= 0) {
      setUploadError(`Maximum ${MAX_IMAGES} images allowed.`);
      return;
    }

    const invalid = selected.find((file) => !file.type.startsWith('image/') || file.size > MAX_IMAGE_SIZE);
    if (invalid) {
      setUploadError('Use image files under 2.5 MB each.');
      return;
    }

    const additions = await Promise.all(
      selected.map(
        (file) =>
          new Promise<TaskImageAttachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                id: `${Date.now()}-${crypto.randomUUID()}`,
                name: file.name,
                size: file.size,
                url: String(reader.result),
                uploadedAt: new Date(),
              });
            reader.onerror = () => reject(new Error('Could not read image'));
            reader.readAsDataURL(file);
          })
      )
    );

    await updateTask({ imageAttachments: [...existing, ...additions] });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = async (imageId: string) => {
    await updateTask({
      imageAttachments: images.filter((image) => image.id !== imageId),
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/tasks/departments/${task.department}`}
              className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wide text-gray-500 hover:text-black mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {DEPARTMENT_LABELS[task.department]} Tasks
            </Link>
            <div className="flex items-center gap-2 mb-2">
              <TaskStatusBadge status={task.status} />
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">
                {DEPARTMENT_LABELS[task.department]}
              </span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">{task.title}</h1>
            <p className="text-sm text-gray-600 leading-relaxed mt-3 max-w-3xl">{task.description}</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {canModify && (
              <button
                type="button"
                onClick={() => setAlertModalOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide border border-red-400 text-red-600 hover:bg-red-50 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Raise Task Alert
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 p-6">
        <main className="space-y-6 min-w-0">
          <section className="border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500">
                Images
              </h2>
              {canModify && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving || images.length >= MAX_IMAGES}
                  className="inline-flex items-center gap-2 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide bg-black text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Upload
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => handleImagesSelected(event.target.files)}
              />
            </div>
            {uploadError && (
              <p className="px-4 pt-3 text-xs font-mono text-red-600">{uploadError}</p>
            )}
            {images.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {images.map((image) => (
                  <figure key={image.id} className="border border-gray-200 bg-white">
                    <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
                      <Image
                        src={image.url}
                        alt={image.name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <figcaption className="p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{image.name}</p>
                        <p className="text-[10px] font-mono text-gray-400 mt-0.5">
                          {Math.round(image.size / 1024)} KB · {formatDateTime(image.uploadedAt)}
                        </p>
                      </div>
                      {canModify && (
                        <button
                          type="button"
                          onClick={() => removeImage(image.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Remove image"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-xs font-mono text-gray-400">No images uploaded for this task.</p>
              </div>
            )}
          </section>

          <section className="border border-gray-200 h-[520px]">
            <CommentThread taskId={task._id} currentUser={currentUser} />
          </section>
        </main>

        <aside className="space-y-4">
          {canModify && (
            <section className="border border-gray-200 p-4">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500 mb-4">
                Status Actions
              </h2>
              <div className="grid grid-cols-1 gap-2">
                <StatusActionButton
                  icon={RotateCcw}
                  label="Mark To Do"
                  active={task.status === TaskStatus.TODO}
                  disabled={saving || task.isLocked || task.status === TaskStatus.BLOCKED}
                  onClick={() => updateTask({ status: TaskStatus.TODO })}
                />
                <StatusActionButton
                  icon={PlayCircle}
                  label="Start Task"
                  active={task.status === TaskStatus.IN_PROGRESS}
                  disabled={saving || task.isLocked || task.status === TaskStatus.BLOCKED}
                  onClick={() => updateTask({ status: TaskStatus.IN_PROGRESS })}
                />
                <StatusActionButton
                  icon={CheckCircle2}
                  label="Mark Done"
                  active={task.status === TaskStatus.DONE}
                  disabled={saving || task.isLocked || task.status === TaskStatus.BLOCKED}
                  onClick={() => updateTask({ status: TaskStatus.DONE })}
                />
              </div>
              {statusError && (
                <p className="text-xs font-mono text-red-600 mt-3">{statusError}</p>
              )}
            </section>
          )}

          <section className="border border-gray-200 p-4">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500 mb-4">
              Task Details
            </h2>
            <div className="space-y-4">
              <DetailRow icon={Hash} label="Task ID" value={task._id} />
              <DetailRow icon={Hash} label="Project ID" value={projectId} />
              {project && (
                <Link
                  href={`/projects/${project._id}`}
                  className="flex items-start gap-3 p-3 border border-gray-200 hover:border-black transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-gray-400 uppercase tracking-wide">Project</p>
                    <p className="text-sm font-bold text-gray-900 truncate">{project.projectTitle}</p>
                    <p className="text-xs text-gray-500 truncate">{project.clientName}</p>
                  </div>
                </Link>
              )}
              <DetailRow icon={User} label="Assigned To" value={assignedUser?.name ?? 'Unassigned'} />
              {task.dueDate && <DetailRow icon={Calendar} label="Due Date" value={formatDate(task.dueDate)} />}
              {task.startDate && <DetailRow icon={PlayCircle} label="Started At" value={formatDateTime(task.startDate)} />}
              {task.completedAt && <DetailRow icon={CheckCircle2} label="Completed At" value={formatDateTime(task.completedAt)} />}
              <DetailRow icon={Calendar} label="Created At" value={formatDateTime(task.createdAt)} />
              {task.isLocked && (
                <div className="flex items-center gap-2 text-[11px] font-mono text-gray-500">
                  <Lock className="w-3.5 h-3.5" />
                  Waiting for dependency to complete
                </div>
              )}
              {task.status === TaskStatus.BLOCKED && (
                <div className="flex items-center gap-2 text-[11px] font-mono text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Blocked by active alert
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      <Modal open={alertModalOpen} onClose={() => setAlertModalOpen(false)} size="md">
        <CreateAlertForm
          projectId={projectId}
          projectTitle={project?.projectTitle ?? projectId}
          taskId={task._id}
          defaultAffectedDepartments={[task.department]}
          title="Raise Task Alert"
          onSuccess={() => {
            setAlertModalOpen(false);
            router.refresh();
          }}
          onCancel={() => setAlertModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

function StatusActionButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: typeof CheckCircle2;
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || active}
      className={cn(
        'flex items-center justify-between gap-3 px-3 py-3 border text-left transition-colors disabled:cursor-not-allowed',
        active
          ? 'bg-black text-white border-black'
          : 'border-gray-200 text-gray-700 hover:border-black disabled:opacity-40'
      )}
    >
      <span className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wide">
        <Icon className="w-4 h-4" />
        {label}
      </span>
      {active && <span className="text-[10px] font-mono uppercase">Current</span>}
    </button>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-mono text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-xs font-mono text-gray-900 break-all">{value}</p>
      </div>
    </div>
  );
}
