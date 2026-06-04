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
import { IAlert, IProject, ITask, IUser, TaskImageAttachment, TaskAttachment, TaskStatus } from '@/types';

interface TaskDetailClientProps {
  initialTask: ITask;
  currentUser: Partial<IUser>;
  canModify: boolean;
}

const MAX_IMAGE_SIZE = 10_000_000; // 10 MB for images
const MAX_FILE_SIZE = 20_000_000;  // 20 MB for documents
const MAX_IMAGES = 12;
const MAX_ATTACHMENTS = 12;

type TabId = 'comments' | 'images' | 'files';

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
  const [doneModalOpen, setDoneModalOpen] = useState(false);
  const [doneComment, setDoneComment] = useState('');
  const [submittingDone, setSubmittingDone] = useState(false);
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const project = getProject(task);
  const projectId = getProjectId(task);
  const assignedUser = getAssignedUser(task);
  const images = task.imageAttachments ?? [];
  const attachments = task.attachments ?? [];

  const isOverdue = task.dueDate ? new Date(task.dueDate) < new Date() && task.status !== TaskStatus.DONE : false;

  const handleMarkDoneWithComment = async () => {
    if (!doneComment.trim()) {
      setStatusError('You must enter a comment before marking the task as complete.');
      return;
    }
    setSubmittingDone(true);
    setStatusError(null);

    // First add the comment
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

    // Then mark as done
    const result = await apiFetch<ITask>(`/api/tasks/${task._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: TaskStatus.DONE }),
    });

    if (result.success && result.data) {
      setTask(result.data);
      setDoneModalOpen(false);
      setDoneComment('');
      setActiveTab('comments');
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
      setUploadError(`Use image files under ${Math.round(MAX_IMAGE_SIZE / 1_000_000)} MB each.`);
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
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const removeImage = async (imageId: string) => {
    await updateTask({
      imageAttachments: images.filter((image) => image.id !== imageId),
    });
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadError(null);
    setFileUploading(true);

    const existing = task.attachments ?? [];
    const availableSlots = MAX_ATTACHMENTS - existing.length;
    const selected = Array.from(files).slice(0, Math.max(availableSlots, 0));

    if (availableSlots <= 0) {
      setUploadError(`Maximum ${MAX_ATTACHMENTS} files allowed.`);
      setFileUploading(false);
      return;
    }

    const invalid = selected.find((file) => file.size > MAX_FILE_SIZE);
    if (invalid) {
      setUploadError(`Use files under ${Math.round(MAX_FILE_SIZE / 1_000_000)} MB each.`);
      setFileUploading(false);
      return;
    }

    const additions = await Promise.all(
      selected.map(
        (file) =>
          new Promise<TaskAttachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                id: `${Date.now()}-${crypto.randomUUID()}`,
                name: file.name,
                size: file.size,
                type: file.type,
                url: String(reader.result),
                uploadedAt: new Date(),
              });
            reader.onerror = () => reject(new Error('Could not read file'));
            reader.readAsDataURL(file);
          })
      )
    );

    await updateTask({ attachments: [...existing, ...additions] });
    setFileUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = async (attachmentId: string) => {
    await updateTask({
      attachments: attachments.filter((a) => a.id !== attachmentId),
    });
  };

  const tabs: { id: TabId; label: string; icon: typeof ImageIcon }[] = [
    { id: 'comments', label: 'Comments', icon: MessageSquare },
    { id: 'images', label: 'Images', icon: ImageIcon },
    { id: 'files', label: 'Files', icon: Paperclip },
  ];

  // Determine if a file type is viewable in browser
  const isViewableFile = (type: string) => {
    return type === 'application/pdf' || type.startsWith('image/');
  };

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') return '📄';
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('spreadsheet') || type.includes('excel') || type.includes('sheet')) return '📊';
    return '📁';
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 px-6 py-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={project ? `/tasks/project/${project._id}` : `/tasks/departments/${task.department}`}
              className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wide text-gray-500 hover:text-black mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {project ? project.projectTitle : getDepartmentLabel(task.department) + ' Tasks'}
            </Link>
            <div className="flex items-center gap-2 mb-2">
              <TaskStatusBadge status={task.status} />
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">
                {getDepartmentLabel(task.department)}
              </span>
            </div>
            <h1 className="text-xl lg:text-2xl font-black text-gray-900 tracking-tight">{task.title}</h1>
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

        {/* Timeline prompt — show when task is assigned but has no start/due dates */}
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

        {/* Overdue indicator */}
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
          <div className="flex border-b border-gray-200">
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
                      ? 'border-black text-black'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Images tab */}
          {activeTab === 'images' && (
            <section className="border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
                <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500">
                  Images ({images.length}/{MAX_IMAGES})
                </h2>
                {canModify && (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={saving || images.length >= MAX_IMAGES}
                    className="inline-flex items-center gap-2 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide bg-black text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload
                  </button>
                )}
                <input
                  ref={imageInputRef}
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
          )}

          {/* Files tab */}
          {activeTab === 'files' && (
            <section className="border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
                <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-500">
                  Files ({attachments.length}/{MAX_ATTACHMENTS})
                </h2>
                {canModify && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving || fileUploading || attachments.length >= MAX_ATTACHMENTS}
                    className="inline-flex items-center gap-2 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide bg-black text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {fileUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {fileUploading ? 'Uploading...' : 'Upload'}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.svg"
                  multiple
                  className="hidden"
                  onChange={(event) => handleFilesSelected(event.target.files)}
                />
              </div>
              {uploadError && (
                <p className="px-4 pt-3 text-xs font-mono text-red-600">{uploadError}</p>
              )}
              {attachments.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {attachments.map((file) => (
                    <div key={file.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <span className="text-lg flex-shrink-0 mt-0.5">{getFileIcon(file.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-gray-900 truncate">{file.name}</p>
                          <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">
                            ({file.size > 1_000_000 ? `${(file.size / 1_000_000).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`})
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-gray-400 mt-0.5">
                          {formatDateTime(file.uploadedAt)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {isViewableFile(file.type) ? (
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-mono text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              Preview
                            </a>
                          ) : (
                            <a
                              href={file.url}
                              download={file.name}
                              className="text-[10px] font-mono text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              <FileText className="w-2.5 h-2.5" />
                              Download
                            </a>
                          )}
                        </div>
                      </div>
                      {canModify && (
                        <button
                          type="button"
                          onClick={() => removeAttachment(file.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                          title="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Paperclip className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-xs font-mono text-gray-400">No files uploaded for this task.</p>
                  <p className="text-[10px] font-mono text-gray-400 mt-0.5">
                    Upload PDFs, documents, spreadsheets, or images (max {Math.round(MAX_FILE_SIZE / 1_000_000)} MB each)
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Comments tab */}
          {activeTab === 'comments' && (
            <section className="border border-gray-200 h-[520px] flex flex-col">
              {task.status === TaskStatus.BLOCKED ? (
                <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
                  <Lock className="w-8 h-8 text-gray-300 mb-3" />
                  <p className="text-sm font-bold text-gray-500 font-mono">Comments Disabled</p>
                  <p className="text-[11px] text-gray-400 font-mono mt-1 max-w-sm">
                    This task is currently blocked by an active alert. Comments are unavailable until the alert is resolved.
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-red-500 bg-red-50 border border-red-200 px-3 py-2">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    Resolve the blocking alert to re-enable comments
                  </div>
                </div>
              ) : (
                <CommentThread taskId={task._id} currentUser={currentUser} />
              )}
            </section>
          )}
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
                  onClick={() => setDoneModalOpen(true)}
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

              {/* Editable timeline section */}
              <div className="border-t border-gray-100 pt-3 mt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
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
                  <p className="text-[11px] text-gray-700 font-mono">
                    <Calendar className="w-3 h-3 inline mr-1 text-gray-400" />
                    Start: {task.startDate ? formatDate(task.startDate) : <span className="text-gray-400 italic">Not set</span>}
                  </p>
                  <p className={cn(
                    'text-[11px] font-mono',
                    isOverdue ? 'text-red-600 font-bold' : 'text-gray-700'
                  )}>
                    <Calendar className="w-3 h-3 inline mr-1 text-gray-400" />
                    Due: {task.dueDate ? formatDate(task.dueDate) : <span className="text-gray-400 italic">Not set</span>}
                    {isOverdue && <span className="ml-2 text-red-600">(OVERDUE)</span>}
                  </p>
                </div>
              </div>

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

      {/* Timeline editing modal */}
      <Modal open={editingDates} onClose={() => { if (!timelineSaving) setEditingDates(false); }} size="sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-900">
              Set Task Timeline
            </h2>
            {!timelineSaving && (
              <button
                type="button"
                onClick={() => { setEditingDates(false); setTimelineError(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[10px] font-mono text-gray-500 mb-4">
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
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                End Date
              </label>
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => { setEditingDates(false); setTimelineError(null); }}
              disabled={timelineSaving}
              className="px-4 py-2 text-[10px] font-mono font-bold uppercase border border-gray-300 text-gray-600 hover:border-gray-600 hover:text-black disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveTimeline}
              disabled={timelineSaving}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold uppercase bg-black text-white hover:bg-gray-800 disabled:opacity-40 transition-colors"
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

      {/* Done with comment modal */}
      <Modal open={doneModalOpen} onClose={() => { if (!submittingDone) setDoneModalOpen(false); }} size="sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-gray-900">
              Complete Task — Comment Required
            </h2>
            {!submittingDone && (
              <button
                type="button"
                onClick={() => { setDoneModalOpen(false); setDoneComment(''); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
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
            className="w-full text-xs font-mono border border-gray-200 px-3 py-2 focus:outline-none focus:border-black transition-colors resize-none placeholder:text-gray-400"
            autoFocus
          />
          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => { setDoneModalOpen(false); setDoneComment(''); }}
              disabled={submittingDone}
              className="px-4 py-2 text-[10px] font-mono font-bold uppercase border border-gray-300 text-gray-600 hover:border-gray-600 hover:text-black disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleMarkDoneWithComment}
              disabled={submittingDone || !doneComment.trim()}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold uppercase bg-black text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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