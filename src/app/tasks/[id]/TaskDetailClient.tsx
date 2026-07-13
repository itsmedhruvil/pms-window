'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import useSWR, { mutate as swrMutate } from 'swr';
import { invalidateTasks } from '@/lib/client-data';
import { dispatchDataChange } from '@/hooks/useRealtime';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Hash,
  Image as ImageIcon,
  Loader2,
  Lock,
  MessageSquare,
  Paperclip,
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
import { apiFetch, cn, getDepartmentLabel, formatDate, formatDateTime } from '@/lib/utils';
import { IAlert, IComment, IProject, ITask, IUser, TaskStatus } from '@/types';

interface TaskDetailClientProps {
  initialTask: ITask;
  currentUser: Partial<IUser>;
  canModify: boolean;
}

const MAX_FILE_SIZE = 20_000_000; // 20 MB for all files
const MAX_FILES = 20;

type TabId = 'comments' | 'files';

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

/** Get all files from a task — merges `files`, `imageAttachments`, `attachments` */
function getAllTaskFiles(task: ITask) {
  const fileMap = new Map<string, {
    id: string;
    name: string;
    url: string;
    size: number;
    type: string;
    publicId?: string;
    uploadedAt: Date;
  }>();

  const sources = [task.files, task.imageAttachments, task.attachments].filter(Boolean) as Array<any[]>;
  for (const arr of sources) {
    for (const f of arr) {
      if (f?.id) {
        fileMap.set(f.id, {
          ...f,
          type: f.type || (f.url?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? 'image/jpeg' : 'application/octet-stream'),
        });
      }
    }
  }

  return Array.from(fileMap.values()).sort(
    (a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
  );
}

function isImageFile(file: { type: string; name?: string }) {
  return file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name || '');
}

function getFileIcon(file: { type: string; name?: string }) {
  if (file.type === 'application/pdf') return '📄';
  if (file.type.startsWith('image/')) return '🖼️';
  if (file.type.includes('word') || file.type.includes('document')) return '📝';
  if (file.type.includes('spreadsheet') || file.type.includes('excel') || file.type.includes('sheet')) return '📊';
  return '📁';
}

export function TaskDetailClient({ initialTask, currentUser, canModify }: TaskDetailClientProps) {
  const [task, setTask] = useState(initialTask);
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [doneModalOpen, setDoneModalOpen] = useState(false);
  const [noCommentWarning, setNoCommentWarning] = useState(false);
  const [doneComment, setDoneComment] = useState('');
  const [submittingDone, setSubmittingDone] = useState(false);
  const [checkingComments, setCheckingComments] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('comments');
  const [editingDates, setEditingDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState(
    task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : ''
  );
  const [editDueDate, setEditDueDate] = useState(
    task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
  );
  const [timelineSaving, setTimelineSaving] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // SWR-based task polling for hot reload
  const { mutate: mutateTask } = useSWR(
    task._id ? `/api/tasks/${task._id}` : null,
    async (url: string) => {
      const res = await fetch(url);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch task');
      return json.data;
    },
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
      onSuccess: (data: ITask) => {
        setTask(data);
      },
    }
  );

  const project = getProject(task);
  const projectId = getProjectId(task);
  const assignedUser = getAssignedUser(task);
  const allFiles = getAllTaskFiles(task);

  const isOverdue = task.dueDate ? new Date(task.dueDate) < new Date() && task.status !== TaskStatus.DONE : false;

  const checkCommentsBeforeDone = useCallback(async () => {
    setCheckingComments(true);
    setNoCommentWarning(false);
    setStatusError(null);

    const result = await apiFetch<{ items: IComment[]; total: number }>(`/api/comments?taskId=${task._id}&limit=1`);

    if (result.success && result.data) {
      const count = result.data.total || result.data.items?.length || 0;
      if (count === 0) {
        setNoCommentWarning(true);
        setDoneModalOpen(true);
      } else {
        await markTaskDone();
      }
    } else {
      await markTaskDone();
    }

    setCheckingComments(false);
  }, [task._id]);

  const markTaskDone = async () => {
    setSubmittingDone(true);
    setStatusError(null);

    const result = await apiFetch<ITask>(`/api/tasks/${task._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: TaskStatus.DONE }),
    });

    if (result.success && result.data) {
      setTask(result.data);
      setDoneModalOpen(false);
      setNoCommentWarning(false);
      setDoneComment('');
      setActiveTab('comments');
      // INSTANT: update SWR cache & dispatch events — no waiting for re-fetch
      void mutateTask(undefined, { revalidate: false });
      void swrMutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/tasks'), undefined, { revalidate: true });
      dispatchDataChange('task', 'updated', result.data);
      router.refresh();
    } else {
      setStatusError(typeof result.error === 'string' ? result.error : 'Could not update task status.');
    }

    setSubmittingDone(false);
  };

  const handleMarkDoneWithComment = async () => {
    if (!doneComment.trim()) {
      setStatusError('You must enter a comment before marking the task as complete.');
      return;
    }
    setSubmittingDone(true);
    setStatusError(null);

    const commentResult = await apiFetch('/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        taskId: task._id,
        content: doneComment.trim(),
        mentions: [],
      }),
    });

    if (!commentResult.success) {
      setStatusError('Failed to add completion comment.');
      setSubmittingDone(false);
      return;
    }

    const result = await apiFetch<ITask>(`/api/tasks/${task._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: TaskStatus.DONE }),
    });

    if (result.success && result.data) {
      setTask(result.data);
      setDoneModalOpen(false);
      setNoCommentWarning(false);
      setDoneComment('');
      setActiveTab('comments');
      // INSTANT: update SWR cache & dispatch events
      void mutateTask(undefined, { revalidate: false });
      void swrMutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/tasks'), undefined, { revalidate: true });
      dispatchDataChange('task', 'updated', result.data);
      router.refresh();
    } else {
      setStatusError(typeof result.error === 'string' ? result.error : 'Could not update task status.');
    }

    setSubmittingDone(false);
  };

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
      // INSTANT: update SWR cache & dispatch events
      void mutateTask(undefined, { revalidate: false });
      void swrMutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/tasks'), undefined, { revalidate: true });
      dispatchDataChange('task', 'updated', result.data);
      router.refresh();
    } else if (patch.status) {
      setStatusError(typeof result.error === 'string' ? result.error : 'Could not update task status.');
    }
  };

  const handleSaveTimeline = async () => {
    if (!editStartDate || !editDueDate) {
      setTimelineError('Both start date and due date are required.');
      return;
    }
    if (new Date(editDueDate) < new Date(editStartDate)) {
      setTimelineError('Due date must be after start date.');
      return;
    }
    setTimelineSaving(true);
    setTimelineError(null);

    await updateTask({
      startDate: new Date(editStartDate) as unknown as Date,
      dueDate: new Date(editDueDate) as unknown as Date,
    });

    setTimelineSaving(false);
    setEditingDates(false);
  };

  /** Upload file(s) to Cloudinary via the API, then save to task */
  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadError(null);
    setFileUploading(true);

    const selected = Array.from(files).slice(0, MAX_FILES - allFiles.length);

    if (allFiles.length >= MAX_FILES) {
      setUploadError(`Maximum ${MAX_FILES} files allowed.`);
      setFileUploading(false);
      return;
    }

    const invalid = selected.find((file) => file.size > MAX_FILE_SIZE);
    if (invalid) {
      setUploadError(`Use files under ${Math.round(MAX_FILE_SIZE / 1_000_000)} MB each.`);
      setFileUploading(false);
      return;
    }

    const existing = allFiles;
    const additions: Array<{
      id: string;
      name: string;
      url: string;
      size: number;
      type: string;
      publicId?: string;
      uploadedAt: Date;
    }> = [];

    for (const file of selected) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();

        if (uploadData.success) {
          additions.push({
            id: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
            name: file.name,
            url: uploadData.data.url,
            size: file.size,
            type: file.type,
            publicId: uploadData.data.publicId,
            uploadedAt: new Date(),
          });
        }
      } catch {
        // skip failed uploads
      }
    }

    if (additions.length > 0) {
      const updatedFiles = [...existing, ...additions];
      const filesForSave = updatedFiles.map((f) => ({
        id: f.id,
        name: f.name,
        url: f.url,
        size: f.size,
        type: f.type,
        publicId: f.publicId,
        uploadedAt: f.uploadedAt.toISOString(),
      }));
      await updateTask({ files: filesForSave } as any);
    }

    setFileUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const removeFile = async (fileId: string) => {
    const updated = allFiles.filter((f) => f.id !== fileId);
    const filesForSave = updated.map((f) => ({
      id: f.id,
      name: f.name,
      url: f.url,
      size: f.size,
      type: f.type,
      publicId: (f as any).publicId,
      uploadedAt: f.uploadedAt,
    }));
    await updateTask({ files: filesForSave } as any);
  };

  const tabs: { id: TabId; label: string; icon: typeof ImageIcon }[] = [
    { id: 'comments', label: 'Comments', icon: MessageSquare },
    { id: 'files', label: `Files (${allFiles.length})`, icon: Paperclip },
  ];

  const imageFiles = allFiles.filter(isImageFile);
  const otherFiles = allFiles.filter((f) => !isImageFile(f));

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-primary-200 px-6 py-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={project ? `/tasks/project/${project._id}` : `/tasks/departments/${task.department}`}
              className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wide text-primary-500 hover:text-dark-500 mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {project ? project.projectTitle : getDepartmentLabel(task.department) + ' Tasks'}
            </Link>
            <div className="flex items-center gap-2 mb-2">
              <TaskStatusBadge status={task.status} />
              <span className="text-xs font-mono text-primary-400 uppercase tracking-widest">
                {getDepartmentLabel(task.department)}
              </span>
            </div>
            <h1 className="text-xl lg:text-2xl font-black text-dark-500 tracking-tight">{task.title}</h1>
            <p className="text-sm text-dark-400 leading-relaxed mt-3 max-w-3xl">{task.description}</p>
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

        {canModify && assignedUser && !task.startDate && !task.dueDate && (
          <div className="mt-4 border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <Calendar className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-800">Timeline Required</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                This task has been assigned to you. Please set a <strong>start date</strong> and <strong>due date</strong> to begin tracking.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingDates(true)}
              className="flex-shrink-0 px-3 py-1.5 text-[10px] font-mono font-bold uppercase bg-amber-600 text-white hover:bg-amber-700 transition-colors"
            >
              Set Timeline
            </button>
          </div>
        )}

        {isOverdue && (
          <div className="mt-3 flex items-center gap-2 text-xs font-mono text-red-600">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="font-bold">OVERDUE</span>
            <span>— Task was due on {formatDate(task.dueDate!)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 p-6">
        <main className="space-y-6 min-w-0">
          {/* Tab bar */}
          <div className="flex border-b border-primary-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-widest border-b-2 transition-colors',
                    activeTab === tab.id
                      ? 'border-dark-500 text-dark-500'
                      : 'border-transparent text-primary-500 hover:text-dark-600 hover:border-primary-300'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Files tab — upload + download only, no inline rendering */}
          {activeTab === 'files' && (
            <section className="border border-primary-200">
              <div className="px-4 py-3 border-b border-primary-200 flex items-center justify-between gap-3">
                <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-primary-500">
                  Attachments ({allFiles.length}/{MAX_FILES})
                </h2>
                {canModify && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={fileUploading || allFiles.length >= MAX_FILES}
                      className="inline-flex items-center gap-2 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide border border-primary-300 text-dark-600 hover:border-dark-500 hover:text-dark-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Take photo (mobile)"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Camera</span>
                    </button>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(event) => uploadFiles(event.target.files)}
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={fileUploading || allFiles.length >= MAX_FILES}
                      className="inline-flex items-center gap-2 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide bg-dark-500 text-white hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {fileUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {fileUploading ? 'Uploading...' : 'Upload'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.svg"
                      multiple
                      className="hidden"
                      onChange={(event) => uploadFiles(event.target.files)}
                    />
                  </div>
                )}
              </div>

              {uploadError && (
                <p className="px-4 pt-3 text-xs font-mono text-red-600">{uploadError}</p>
              )}

              {allFiles.length === 0 ? (
                <div className="p-12 text-center">
                  <Paperclip className="w-8 h-8 text-primary-300 mx-auto mb-3" />
                  <p className="text-xs font-mono text-primary-400">No files uploaded for this task.</p>
                  <p className="text-[10px] font-mono text-primary-400 mt-0.5">
                    Upload images, PDFs, documents, spreadsheets, or take a photo (max {Math.round(MAX_FILE_SIZE / 1_000_000)} MB each)
                  </p>
                </div>
              ) : (
                <div className="space-y-6 p-4">
                  {/* Image gallery */}
                  {imageFiles.length > 0 && (
                    <div>
                      <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-primary-500 mb-3">
                        Images ({imageFiles.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {imageFiles.map((file) => (
                          <figure key={file.id} className="border border-primary-200 bg-white group">
                            <div className="relative aspect-[4/3] bg-primary-50 overflow-hidden">
                              <Image
                                src={file.url}
                                alt={file.name}
                                fill
                                unoptimized
                                className="object-cover"
                              />
                              {canModify && (
                                <button
                                  type="button"
                                  onClick={() => removeFile(file.id)}
                                  className="absolute top-2 right-2 p-1 bg-dark-500/60 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                  title="Remove"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <figcaption className="p-3">
                              <p className="text-xs font-bold text-dark-500 truncate">{file.name}</p>
                              <p className="text-[10px] font-mono text-primary-400 mt-0.5">
                                {file.size > 1_000_000
                                  ? `${(file.size / 1_000_000).toFixed(1)} MB`
                                  : `${Math.round(file.size / 1024)} KB`}
                                {' · '}
                                {formatDateTime(file.uploadedAt)}
                              </p>
                              <a
                                href={file.url}
                                download={file.name}
                                className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-600 hover:text-blue-800 mt-1"
                              >
                                <Download className="w-3 h-3" />
                                Download
                              </a>
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Other files (documents, spreadsheets, etc.) */}
                  {otherFiles.length > 0 && (
                    <div>
                      <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-primary-500 mb-3">
                        Documents ({otherFiles.length})
                      </h3>
                      <div className="divide-y divide-gray-100 border border-primary-200">
                        {otherFiles.map((file) => (
                          <div key={file.id} className="flex items-start gap-3 px-4 py-3 hover:bg-primary-50 transition-colors group">
                            <span className="text-lg flex-shrink-0 mt-0.5">{getFileIcon(file)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-dark-500 truncate">{file.name}</p>
                                <span className="text-[10px] font-mono text-primary-400 flex-shrink-0">
                                  ({file.size > 1_000_000 ? `${(file.size / 1_000_000).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`})
                                </span>
                              </div>
                              <p className="text-[10px] font-mono text-primary-400 mt-0.5">
                                {formatDateTime(file.uploadedAt)}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <a
                                  href={file.url}
                                  download={file.name}
                                  className="text-[10px] font-mono text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                >
                                  <Download className="w-3 h-3" />
                                  Download
                                </a>
                                {(file.type === 'application/pdf' || file.type.startsWith('image/')) && (
                                  <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] font-mono text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                    Open
                                  </a>
                                )}
                              </div>
                            </div>
                            {canModify && (
                              <button
                                type="button"
                                onClick={() => removeFile(file.id)}
                                className="p-1 text-primary-400 hover:text-red-600 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                                title="Remove file"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Comments tab */}
          {activeTab === 'comments' && (
            <section className="border border-primary-200 h-[520px] flex flex-col">
              {task.status === TaskStatus.BLOCKED ? (
                <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
                  <Lock className="w-8 h-8 text-primary-300 mb-3" />
                  <p className="text-sm font-bold text-primary-500 font-mono">Comments Disabled</p>
                  <p className="text-[11px] text-primary-400 font-mono mt-1 max-w-sm">
                    This task is currently blocked by an active alert. Comments are unavailable until the alert is resolved.
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-red-500 bg-red-50 border border-red-200 px-3 py-2">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    Resolve the blocking alert to re-enable comments
                  </div>
                </div>
              ) : (
                <CommentThread taskId={task._id} currentUser={currentUser} availableUsers={[]} />
              )}
            </section>
          )}
        </main>

        <aside className="space-y-4">
          {canModify && (
            <section className="border border-primary-200 p-4">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-primary-500 mb-4">
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
                  disabled={saving || task.isLocked || task.status === TaskStatus.BLOCKED || checkingComments}
                  onClick={checkCommentsBeforeDone}
                />
              </div>
              {statusError && (
                <p className="text-xs font-mono text-red-600 mt-3">{statusError}</p>
              )}
            </section>
          )}

          <section className="border border-primary-200 p-4">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-primary-500 mb-4">
              Task Details
            </h2>
            <div className="space-y-4">
              <DetailRow icon={Hash} label="Task ID" value={task._id} />
              <DetailRow icon={Hash} label="Project ID" value={projectId} />
              {project && (
                <Link
                  href={`/projects/${project._id}`}
                  className="flex items-start gap-3 p-3 border border-primary-200 hover:border-dark-500 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-primary-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-primary-400 uppercase tracking-wide">Project</p>
                    <p className="text-sm font-bold text-dark-500 truncate">{project.projectTitle}</p>
                    <p className="text-xs text-primary-500 truncate">{project.clientName}</p>
                  </div>
                </Link>
              )}
              <DetailRow icon={User} label="Assigned To" value={assignedUser?.name ?? 'Unassigned'} />

              <div className="border-t border-primary-100 pt-3 mt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary-500">
                    Timeline
                  </p>
                  {canModify && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditStartDate(task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '');
                        setEditDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
                        setTimelineError(null);
                        setEditingDates(true);
                      }}
                      className="text-[10px] font-mono text-blue-600 hover:text-blue-800 underline"
                    >
                      {task.startDate || task.dueDate ? 'Edit' : 'Set'}
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-dark-600 font-mono">
                    <Calendar className="w-3 h-3 inline mr-1 text-primary-400" />
                    Start: {task.startDate ? formatDate(task.startDate) : <span className="text-primary-400 italic">Not set</span>}
                  </p>
                  <p className={cn(
                    'text-[11px] font-mono',
                    isOverdue ? 'text-red-600 font-bold' : 'text-dark-600'
                  )}>
                    <Calendar className="w-3 h-3 inline mr-1 text-primary-400" />
                    Due: {task.dueDate ? formatDate(task.dueDate) : <span className="text-primary-400 italic">Not set</span>}
                    {isOverdue && <span className="ml-2 text-red-600">(OVERDUE)</span>}
                  </p>
                </div>
              </div>

              {task.completedAt && <DetailRow icon={CheckCircle2} label="Completed At" value={formatDateTime(task.completedAt)} />}
              <DetailRow icon={Calendar} label="Created At" value={formatDateTime(task.createdAt)} />
              {task.isLocked && (
                <div className="flex items-center gap-2 text-[11px] font-mono text-primary-500">
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

      {/* Timeline editing modal */}
      <Modal open={editingDates} onClose={() => { if (!timelineSaving) setEditingDates(false); }} size="sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-dark-500">
              Set Task Timeline
            </h2>
            {!timelineSaving && (
              <button
                type="button"
                onClick={() => { setEditingDates(false); setTimelineError(null); }}
                className="text-primary-400 hover:text-dark-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[10px] font-mono text-primary-500 mb-4">
            Set the start date and expected due date for this task.
          </p>

          {timelineError && (
            <div className="flex items-center gap-2 p-2 mb-4 border border-red-300 bg-red-50">
              <AlertTriangle className="w-3 h-3 text-red-600 flex-shrink-0" />
              <p className="text-[10px] font-mono text-red-700">{timelineError}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-primary-500 mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-primary-200 focus:outline-none focus:border-dark-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-primary-500 mb-1.5">
                End Date
              </label>
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-primary-200 focus:outline-none focus:border-dark-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-primary-200">
            <button
              type="button"
              onClick={() => { setEditingDates(false); setTimelineError(null); }}
              disabled={timelineSaving}
              className="px-4 py-2 text-[10px] font-mono font-bold uppercase border border-primary-300 text-dark-400 hover:border-dark-400 hover:text-dark-500 disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveTimeline}
              disabled={timelineSaving}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold uppercase bg-dark-500 text-white hover:bg-dark-600 disabled:opacity-40 transition-colors"
            >
              {timelineSaving ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Calendar className="w-3.5 h-3.5" />
                  Save Timeline
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Done modal */}
      <Modal open={doneModalOpen} onClose={() => { if (!submittingDone) { setDoneModalOpen(false); setNoCommentWarning(false); setDoneComment(''); } }} size="sm">
        <div className="p-6">
          {noCommentWarning ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-dark-500">
                  Comment Required
                </h2>
                <button
                  type="button"
                  onClick={() => { setDoneModalOpen(false); setNoCommentWarning(false); }}
                  className="text-primary-400 hover:text-dark-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-3 p-4 border border-amber-300 bg-amber-50">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold font-mono text-amber-800">Please add a comment first</p>
                  <p className="text-[10px] font-mono text-amber-700 mt-1">
                    Go to the <strong>Comments</strong> tab to add a comment about what was accomplished, then click &ldquo;Mark Done&rdquo; again.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-primary-200">
                <button
                  type="button"
                  onClick={() => { setDoneModalOpen(false); setNoCommentWarning(false); setActiveTab('comments'); }}
                  className="px-4 py-2 text-[10px] font-mono font-bold uppercase border border-primary-300 text-dark-400 hover:border-dark-400 hover:text-dark-500 transition-colors"
                >
                  Go to Comments
                </button>
                <button
                  type="button"
                  onClick={() => { setDoneModalOpen(false); setNoCommentWarning(false); }}
                  className="px-4 py-2 text-[10px] font-mono font-bold uppercase bg-dark-500 text-white hover:bg-dark-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-dark-500">
                  Complete Task &mdash; Comment Required
                </h2>
                {!submittingDone && (
                  <button
                    type="button"
                    onClick={() => { setDoneModalOpen(false); setDoneComment(''); }}
                    className="text-primary-400 hover:text-dark-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 p-3 mb-4 border border-amber-300 bg-amber-50">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-[10px] font-mono text-amber-800">
                  A comment is required before marking this task as complete. Describe what was accomplished.
                </p>
              </div>
              <textarea
                value={doneComment}
                onChange={(e) => setDoneComment(e.target.value)}
                placeholder="Describe what was completed, any issues encountered, or handover notes..."
                rows={4}
                className="w-full text-xs font-mono border border-primary-200 px-3 py-2 focus:outline-none focus:border-dark-500 transition-colors resize-none placeholder:text-primary-400"
                autoFocus
              />
              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-primary-200">
                <button
                  type="button"
                  onClick={() => { setDoneModalOpen(false); setDoneComment(''); }}
                  disabled={submittingDone}
                  className="px-4 py-2 text-[10px] font-mono font-bold uppercase border border-primary-300 text-dark-400 hover:border-dark-400 hover:text-dark-500 disabled:opacity-40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleMarkDoneWithComment}
                  disabled={submittingDone || !doneComment.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold uppercase bg-dark-500 text-white hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {submittingDone ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {doneComment.trim() ? 'Mark Done' : 'Add comment first'}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal open={alertModalOpen} onClose={() => setAlertModalOpen(false)} size="md">
        <CreateAlertForm
          projectId={projectId}
          projectTitle={project?.projectTitle ?? projectId}
          taskId={task._id}
          defaultAffectedDepartments={[task.department]}
          title="Raise Task Alert"
          onSuccess={(alert: IAlert) => {
            setTask((prev) => ({ ...prev, status: TaskStatus.BLOCKED }));
            setAlertModalOpen(false);
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
          ? 'bg-dark-500 text-white border-dark-500'
          : 'border-primary-200 text-dark-600 hover:border-dark-500 disabled:opacity-40'
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
      <Icon className="w-4 h-4 text-primary-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-mono text-primary-400 uppercase tracking-wide">{label}</p>
        <p className="text-xs font-mono text-dark-500 break-all">{value}</p>
      </div>
    </div>
  );
}