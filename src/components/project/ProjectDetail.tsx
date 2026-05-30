'use client';

import { useState, useCallback, useRef, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ExcelJS from 'exceljs';
import {
  AlertTriangle, Calendar, Package, ChevronRight,
  CheckCircle2, Copy, Trash2, ArrowUpRight, Edit3,
  X, Save, Upload, FileText, Tag, Layers,
} from 'lucide-react';
import { apiFetch } from '@/lib/utils';
import { cn, getDepartmentLabel, formatDate, ALERT_TYPE_LABEL, normalizeProjectPriority } from '@/lib/utils';
import {
  ProjectStatusBadge, PriorityBadge, TaskStatusBadge, AlertSeverityBadge
} from '@/components/ui/badges';
import { useProjectRealtime } from '@/hooks/useRealtime';
import { ProjectStatusControl } from '@/components/project/ProjectStatusControl';
import { CreateAlertForm } from '@/components/forms/CreateAlertForm';
import { Modal } from '@/components/ui/Modal';
import type { IProject, ITask, IAlert, IUser, PdfAttachment, WindowSpec } from '@/types';
import { TaskStatus, AlertStatus, Department, ProjectPriority, ProjectStatus, UserRole } from '@/types';
import { useDepartments } from '@/hooks/useDepartments';

interface ProjectDetailProps {
  project: IProject;
  tasks: ITask[];
  alerts: IAlert[];
  isAdmin: boolean;
  currentUserDepartment?: Department;
  currentUserRole?: UserRole;
}

export function ProjectDetail({
  project: initialProject,
  tasks: initialTasks,
  alerts: initialAlerts,
  isAdmin,
  currentUserDepartment,
  currentUserRole,
}: ProjectDetailProps) {
  const router = useRouter();
  const departments = useDepartments();
  const [project, setProject] = useState(initialProject);
  const [tasks, setTasks] = useState(initialTasks);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState({
    clientName: initialProject.clientName,
    projectTitle: initialProject.projectTitle,
    description: initialProject.description || '',
    address: initialProject.address || '',
    contactPhone: initialProject.contactPhone || '',
    totalWindows: initialProject.totalWindows,
    startDate: initialProject.startDate ? new Date(initialProject.startDate).toISOString().split('T')[0] : '',
    deadline: initialProject.deadline ? new Date(initialProject.deadline).toISOString().split('T')[0] : '',
    endDate: initialProject.endDate ? new Date(initialProject.endDate).toISOString().split('T')[0] : '',
    priority: normalizeProjectPriority(initialProject.priority),
  });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleExcelUpload = async (file: File) => {
    setExcelError(null);
    setExcelLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        setExcelError('The selected spreadsheet does not contain any sheets.');
        return;
      }

      const headerRow = worksheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell) => {
        headers.push(String(cell.value ?? `Column${headers.length + 1}`));
      });

      const rows: Record<string, string | number | boolean | null>[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowData: Record<string, string | number | boolean | null> = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1];
          const val = cell.value;
          if (val === null || val === undefined) {
            rowData[header] = null;
          } else if (val instanceof Date) {
            rowData[header] = val.toISOString();
          } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
            rowData[header] = val;
          } else {
            rowData[header] = String(val);
          }
        });
        if (Object.keys(rowData).length > 0) {
          rows.push(rowData);
        }
      });

      const result = await apiFetch(`/api/projects/${project._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ excelSheetName: worksheet.name || 'Sheet1', excelRows: rows }),
      });

      if (result.success && result.data) {
        setProject(result.data as IProject);
      } else {
        setExcelError(result.error || 'Failed to upload Excel data');
      }
    } catch (err) {
      setExcelError('Could not read the Excel file. Make sure it is a valid .xlsx or .xls file.');
    } finally {
      setExcelLoading(false);
    }
  };

  // Realtime updates
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setPdfUploading(true);
    setPdfError(null);

    try {
      const newPdfs: PdfAttachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type !== 'application/pdf') {
          setPdfError('Only PDF files are allowed.');
          setPdfUploading(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();

        if (!uploadData.success) {
          throw new Error(uploadData.error || 'Upload failed');
        }

        newPdfs.push({
          id: `${Date.now()}-${i}`,
          name: uploadData.data.name,
          url: uploadData.data.url,
          size: uploadData.data.size,
          uploadedAt: new Date().toISOString() as unknown as Date,
        });
      }

      const existing = project.pdfAttachments || [];
      const allPdfs = [...existing, ...newPdfs];

      const result = await apiFetch(`/api/projects/${project._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ pdfAttachments: allPdfs }),
      });

      if (result.success && result.data) {
        setProject(result.data as IProject);
      } else {
        setPdfError(result.error || 'Failed to save PDF to project');
      }
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Failed to upload PDF');
    } finally {
      setPdfUploading(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  // Only admin can delete PDFs
  const removePdf = async (pdfId: string) => {
    if (!isAdmin) return;
    const remaining = (project.pdfAttachments || []).filter((p) => p.id !== pdfId);
    const result = await apiFetch(`/api/projects/${project._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ pdfAttachments: remaining }),
    });
    if (result.success && result.data) {
      setProject(result.data as IProject);
    }
  };

  // Design PDF upload per window specification
  const handleDesignPdfUpload = async (specIndex: number, file: File) => {
    if (file.type !== 'application/pdf') return;

    const formData = new FormData();
    formData.append('file', file);
    const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
    const uploadData = await uploadRes.json();
    if (!uploadData.success) return;

    const newSpecs = [...(project.windowSpecifications || [])];
    const spec = { ...newSpecs[specIndex] };
    spec.designPdf = {
      id: `${Date.now()}-${specIndex}`,
      name: uploadData.data.name,
      url: uploadData.data.url,
      size: uploadData.data.size,
      uploadedAt: new Date().toISOString() as unknown as Date,
    };
    newSpecs[specIndex] = spec;

    const result = await apiFetch(`/api/projects/${project._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ windowSpecifications: newSpecs }),
    });
    if (result.success && result.data) {
      setProject(result.data as IProject);
    }
  };

  const removeDesignPdf = async (specIndex: number) => {
    if (!isAdmin) return;
    const newSpecs = [...(project.windowSpecifications || [])];
    const spec = { ...newSpecs[specIndex] };
    delete spec.designPdf;
    newSpecs[specIndex] = spec;

    const result = await apiFetch(`/api/projects/${project._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ windowSpecifications: newSpecs }),
    });
    if (result.success && result.data) {
      setProject(result.data as IProject);
    }
  };

  useProjectRealtime(project._id, {
    onTaskUpdated: useCallback((updatedTask: ITask) => {
      setTasks((prev) => prev.map((t) => t._id === updatedTask._id ? updatedTask : t));
    }, []),
    onAlertCreated: useCallback((alert: IAlert) => {
      setAlerts((prev) => (prev.some((a) => a._id === alert._id) ? prev : [alert, ...prev]));
    }, []),
    onAlertUpdated: useCallback((updatedAlert: IAlert) => {
      setAlerts((prev) => prev.map((a) => a._id === updatedAlert._id ? updatedAlert : a));
    }, []),
    onProjectStatusChanged: useCallback((data: { projectId: string; status: IProject['status']; completionPercentage?: number }) => {
      setProject((prev) => ({
        ...prev,
        status: data.status,
        completionPercentage: data.completionPercentage ?? prev.completionPercentage,
      }));
    }, []),
  });

  const handleDuplicateProject = async () => {
    try {
      const response = await fetch(`/api/projects/${project._id}/duplicate`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        window.location.href = `/projects/${data.data.project._id}`;
      }
    } catch (error) {
      console.error('Failed to duplicate project:', error);
    }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return;

    setIsDeleting(true);
    setDeleteError(null);

    const result = await apiFetch(`/api/projects/${project._id}`, { method: 'DELETE' });
    setIsDeleting(false);

    if (!result.success) {
      setDeleteError(typeof result.error === 'string' ? result.error : 'Failed to delete project');
      return;
    }

    router.push('/projects');
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    setEditError(null);
    const result = await apiFetch(`/api/projects/${project._id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        clientName: editForm.clientName,
        projectTitle: editForm.projectTitle,
        description: editForm.description,
        address: editForm.address,
        contactPhone: editForm.contactPhone,
        totalWindows: editForm.totalWindows,
        startDate: editForm.startDate,
        deadline: editForm.deadline,
        endDate: editForm.endDate,
        priority: editForm.priority,
      }),
    });
    setSaving(false);
    if (!result.success) {
      setEditError(typeof result.error === 'string' ? result.error : 'Failed to update project');
      return;
    }
    setProject(result.data as IProject);
    setEditModalOpen(false);
    router.refresh();
  };

  const openEditModal = () => {
    setEditForm({
      clientName: project.clientName,
      projectTitle: project.projectTitle,
      description: project.description || '',
      address: project.address || '',
      contactPhone: project.contactPhone || '',
      totalWindows: project.totalWindows,
      startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
      deadline: project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : '',
      endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '',
      priority: normalizeProjectPriority(project.priority),
    });
    setEditError(null);
    setEditModalOpen(true);
  };

  const taskDepartments = [...new Set(tasks.map((task) => task.department))] as Department[];
  const visibleDepartments = isAdmin
    ? [
        ...departments.map((department) => department.name),
        ...taskDepartments.filter((department) => !departments.some((item) => item.name === department)),
      ]
    : currentUserDepartment
      ? [currentUserDepartment]
      : taskDepartments;
  const activeAlerts = alerts.filter((a) => a.status !== AlertStatus.RESOLVED);
  const completedTasks = tasks.filter((t) => t.status === TaskStatus.DONE).length;
  const visibleCompletionPercentage = tasks.length > 0
    ? Math.round((completedTasks / tasks.length) * 100)
    : 0;
  const hasActiveAlerts = activeAlerts.length > 0;

  return (
    <div className={cn('min-h-screen bg-gray-50', hasActiveAlerts && 'border-t-4 border-t-red-500')}>
      {/* Alert banner */}
      {hasActiveAlerts && (
        <div className="bg-red-600 text-white px-8 py-2.5 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 animate-pulse" />
          <span className="text-sm font-mono font-bold">
            {activeAlerts.length} OPEN ALERT{activeAlerts.length > 1 ? 'S' : ''} — PROJECT ON HOLD
          </span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 text-xs font-mono text-gray-400">
              <span className="uppercase tracking-widest">{project.clientName || 'Project'}</span>
              <ChevronRight className="w-3 h-3" />
              <span>Project</span>
            </div>
            <h1 className="text-xl lg:text-2xl font-black text-gray-900 tracking-tight">
              {project.projectTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <ProjectStatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Calendar className="w-3.5 h-3.5" />
                <span className="font-mono">Due {formatDate(project.deadline)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Package className="w-3.5 h-3.5" />
                <span className="font-mono">{project.totalWindows} windows</span>
              </div>
              {project.productTypes && project.productTypes.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Layers className="w-3.5 h-3.5" />
                  <span className="font-mono">{project.productTypes.join(', ')}</span>
                </div>
              )}
              {project.tags && project.tags.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Tag className="w-3.5 h-3.5" />
                  <span className="font-mono">{project.tags.slice(0, 3).join(', ')}{project.tags.length > 3 ? ` +${project.tags.length - 3}` : ''}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right side stats + actions */}
          <div className="flex-shrink-0 flex flex-row lg:flex-col items-start lg:items-end gap-3">
            <div className="text-left lg:text-right">
              <div className="text-3xl lg:text-4xl font-black font-mono text-gray-900">
                {isAdmin ? project.completionPercentage : visibleCompletionPercentage}%
              </div>
              <div className="text-[10px] text-gray-400 font-mono uppercase tracking-wide">
                {isAdmin ? 'Complete' : `${getDepartmentLabel(currentUserDepartment)} Complete`}
              </div>
              <div className="text-xs text-gray-500 mt-0.5 font-mono">
                {completedTasks}/{tasks.length} tasks done
              </div>
            </div>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <ProjectStatusControl
                  project={project}
                  hasActiveAlerts={hasActiveAlerts}
                  onStatusChange={(updated) => setProject(updated)}
                />
                <button
                  onClick={() => setAlertModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold uppercase border border-red-400 text-red-600 hover:bg-red-50 transition-colors rounded-md"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Alert
                </button>
                <button
                  onClick={handleDuplicateProject}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold uppercase border border-blue-400 text-blue-600 hover:bg-blue-50 transition-colors rounded-md"
                >
                  <Copy className="w-3 h-3" />
                  Duplicate
                </button>
                <button
                  onClick={handleDeleteProject}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold uppercase border border-red-400 text-red-600 hover:bg-red-50 transition-colors rounded-md disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  {isDeleting ? '…' : 'Delete'}
                </button>
              </div>
            )}
            {deleteError && <p className="text-xs font-mono text-red-600">{deleteError}</p>}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5 h-2 bg-gray-100 w-full rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-700 rounded-full', hasActiveAlerts ? 'bg-red-500' : 'bg-black')}
            style={{ width: `${isAdmin ? project.completionPercentage : visibleCompletionPercentage}%` }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="p-8 space-y-8">
        {/* Project Info Section */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-700">Project Details</h2>
            <button
              onClick={openEditModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold uppercase border border-gray-300 text-gray-600 hover:border-gray-800 hover:text-black transition-colors rounded-md"
            >
              <Edit3 className="w-3 h-3" />
              Edit
            </button>
          </div>

          {/* Description */}
          {project.description && (
            <div className="mb-4 pb-4 border-b border-gray-100">
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-1">Description</p>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{project.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-1">Address</p>
              <p className="text-xs text-gray-900">{project.address || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-1">Contact</p>
              <p className="text-xs text-gray-900">{project.contactPhone || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-1">Total Windows</p>
              <p className="text-xs text-gray-900">{project.totalWindows}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-1">Budget</p>
              <p className="text-xs text-gray-900">{project.budget ? `₹${project.budget.toLocaleString()}` : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-1">Start Date</p>
              <p className="text-xs text-gray-900">{project.startDate ? formatDate(project.startDate) : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-1">End Date</p>
              <p className="text-xs text-gray-900">{project.endDate ? formatDate(project.endDate) : '—'}</p>
            </div>
          </div>

          {/* Product Types */}
          {project.productTypes && project.productTypes.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-2">Product Types</p>
              <div className="flex flex-wrap gap-1.5">
                {project.productTypes.map((pt) => (
                  <span key={pt} className="px-2 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-700 rounded">
                    {pt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {project.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-700 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Window Specifications */}
          {project.windowSpecifications && project.windowSpecifications.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-2">Window Specifications</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs font-mono">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-600 uppercase tracking-wider text-[10px]">#</th>
                      <th className="px-3 py-2 font-semibold text-gray-600 uppercase tracking-wider text-[10px]">Design</th>
                      <th className="px-3 py-2 font-semibold text-gray-600 uppercase tracking-wider text-[10px]">Design PDF</th>
                      <th className="px-3 py-2 font-semibold text-gray-600 uppercase tracking-wider text-[10px]">Size (mm)</th>
                      <th className="px-3 py-2 font-semibold text-gray-600 uppercase tracking-wider text-[10px]">Glass</th>
                      <th className="px-3 py-2 font-semibold text-gray-600 uppercase tracking-wider text-[10px]">Qty</th>
                      <th className="px-3 py-2 font-semibold text-gray-600 uppercase tracking-wider text-[10px]">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.windowSpecifications.map((spec, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-bold text-gray-900">{spec.design || '—'}</td>
                        <td className="px-3 py-2">
                          {spec.designPdf ? (
                            <div className="flex items-center gap-1">
                              <a
                                href={spec.designPdf.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:underline"
                              >
                                <FileText className="w-3 h-3" />
                                <span className="text-[10px]">{spec.designPdf.name}</span>
                              </a>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => removeDesignPdf(i)}
                                  className="text-gray-400 hover:text-red-500"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">—</span>
                              <input
                                type="file"
                                accept=".pdf"
                                id={`spec-design-pdf-${i}`}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleDesignPdfUpload(i, file);
                                  e.target.value = '';
                                }}
                              />
                              <label
                                htmlFor={`spec-design-pdf-${i}`}
                                className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono text-gray-400 border border-dashed border-gray-300 rounded cursor-pointer hover:border-gray-500 hover:text-gray-600"
                              >
                                <Upload className="w-2.5 h-2.5" />
                                Upload
                              </label>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{spec.width > 0 ? `${spec.width}×${spec.height}` : '—'}</td>
                        <td className="px-3 py-2 text-gray-700">{spec.glassType || '—'}</td>
                        <td className="px-3 py-2 font-bold">×{spec.quantity}</td>
                        <td className="px-3 py-2 text-gray-500">{spec.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* PDF Upload Section */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-700">PDF Attachments</h2>
            <input
              ref={pdfInputRef}
              type="file"
              multiple
              accept=".pdf"
              className="hidden"
              onChange={handlePdfUpload}
            />
            <button
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              disabled={pdfUploading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase border border-gray-200 text-gray-600 hover:border-black hover:text-black disabled:opacity-50 transition-colors rounded-md"
            >
              <Upload className="w-3 h-3" />
              {pdfUploading ? 'Uploading...' : 'Upload PDF'}
            </button>
          </div>

          {pdfError && (
            <div className="flex items-center gap-2 p-3 mb-3 border border-red-300 bg-red-50">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700 font-mono">{pdfError}</p>
            </div>
          )}

          {project.pdfAttachments && project.pdfAttachments.length > 0 ? (
            <div className="space-y-2">
              {project.pdfAttachments.map((pdf) => (
                <div key={pdf.id} className="flex items-center justify-between px-3 py-2 border border-gray-200 hover:border-gray-400 transition-colors rounded-md">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <a
                      href={pdf.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-gray-900 hover:underline truncate"
                    >
                      {pdf.name}
                    </a>
                    <span className="text-[9px] font-mono text-gray-400 flex-shrink-0">
                      ({(pdf.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => removePdf(pdf.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 ml-2"
                      title="Remove PDF"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-gray-200 rounded-md p-6 text-center">
              <FileText className="w-6 h-6 text-gray-300 mx-auto mb-1" />
              <p className="text-xs text-gray-400 font-mono">No PDF files attached</p>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">Upload PDFs like drawings, contracts, or specs</p>
            </div>
          )}
        </div>

        {/* Excel Upload Section */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-700">Excel Data</h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  {project.excelRows ? `${project.excelRows.length} rows uploaded` : 'No spreadsheet uploaded'}
                </p>
              </div>
              <div className="text-gray-400 group-open:rotate-180 transition-transform">
                <ChevronRight className="w-4 h-4" />
              </div>
            </summary>

            <div className="mt-4">
              {excelError && (
                <div className="flex items-center gap-2 p-3 mb-3 border border-red-300 bg-red-50">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-xs text-red-700 font-mono">{excelError}</p>
                </div>
              )}
              {(!project.excelRows || project.excelRows.length === 0) && (
                <ExcelUpload onUpload={handleExcelUpload} loading={excelLoading} />
              )}

              {project.excelRows && project.excelRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-500">
                      Sheet: {project.excelSheetName || 'Imported'}
                    </span>
                    <ExcelUpload onUpload={handleExcelUpload} loading={excelLoading} />
                  </div>
                  <div className="overflow-x-auto border-2 border-gray-300 rounded-sm">
                    <table className="min-w-full text-left text-xs font-mono border-collapse">
                      <thead>
                        <tr>
                          <th className="w-10 px-2 py-1.5 text-[10px] font-bold text-gray-500 bg-gray-100 border border-gray-300 text-center sticky left-0 z-10">
                            #
                          </th>
                          {Object.keys(project.excelRows[0]).map((header) => (
                            <th key={header} className="px-3 py-1.5 font-bold text-gray-700 bg-gray-100 border border-gray-300 text-[11px] whitespace-nowrap">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {project.excelRows.map((row, rowIndex) => (
                          <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-2 py-1.5 text-[10px] font-bold text-gray-400 bg-gray-50 border border-gray-300 text-center select-none sticky left-0 z-10">
                              {rowIndex + 1}
                            </td>
                            {Object.keys(project.excelRows![0]).map((header) => {
                              const value = row[header];
                              const displayValue = value === null || value === undefined ? '' : String(value);
                              return (
                                <td key={`${rowIndex}-${header}`} className="px-3 py-1.5 text-gray-700 border border-gray-300 whitespace-nowrap min-w-[100px]">
                                  {displayValue || <span className="text-gray-300">—</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] font-mono text-gray-400 mt-2">
                    {project.excelRows.length} row{project.excelRows.length === 1 ? '' : 's'} · {Object.keys(project.excelRows[0]).length} column{Object.keys(project.excelRows[0]).length === 1 ? '' : 's'}
                  </p>
                </div>
              )}
            </div>
          </details>
        </div>

        {/* Department Progress + Alerts */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Department completion cards */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest text-gray-700">Department Progress</h2>
              <span className="text-xs font-mono text-gray-400">{tasks.length} total tasks</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleDepartments.map((dept) => {
                const deptTasks = tasks.filter((t) => t.department === dept);
                const done = deptTasks.filter((t) => t.status === TaskStatus.DONE).length;
                const blocked = deptTasks.filter((t) => t.status === TaskStatus.BLOCKED).length;
                const inProgress = deptTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
                const pct = deptTasks.length > 0 ? Math.round((done / deptTasks.length) * 100) : 0;

                return (
                  <Link
                    key={dept}
                    href={`/projects/${project._id}/departments/${dept}`}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-400 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono uppercase tracking-wider font-bold text-gray-600">
                        {departments.find((department) => department.name === dept)?.label || getDepartmentLabel(dept)}
                      </span>
                      <span className="text-sm font-black font-mono text-gray-900">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-black rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-[10px] font-mono text-gray-500">
                      <span className="text-green-600 font-bold">{done}</span>/<span>{deptTasks.length}</span> done
                      {blocked > 0 && <span className="text-red-500">· {blocked} blocked</span>}
                      {inProgress > 0 && <span className="text-blue-500">· {inProgress} active</span>}
                    </div>
                    <div className="mt-2 text-[9px] font-mono text-gray-400 group-hover:text-black transition-colors flex items-center gap-1">
                      View tasks <ArrowUpRight className="w-2.5 h-2.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Active alerts sidebar */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-700">
                {activeAlerts.length > 0 ? `Alerts (${activeAlerts.length})` : 'Alerts'}
              </h2>
            </div>
            {activeAlerts.length > 0 ? (
              <div className="space-y-2">
                {activeAlerts.slice(0, 4).map((alert) => (
                  <div key={alert._id} className="bg-white border border-red-200 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertSeverityBadge severity={alert.severity} />
                      <span className="text-[10px] font-mono font-bold uppercase text-gray-500">
                        {ALERT_TYPE_LABEL[alert.type]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-2">{alert.message}</p>
                  </div>
                ))}
                {activeAlerts.length > 4 && (
                  <p className="text-xs text-gray-400 font-mono">+{activeAlerts.length - 4} more</p>
                )}
              </div>
            ) : (
              <div className="bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center">
                <CheckCircle2 className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                <p className="text-xs text-gray-400">No active alerts</p>
              </div>
            )}
          </div>
        </div>

        {/* Workflow Timeline */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-700">Workflow Timeline</h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                {isAdmin ? 'Task status across all departments' : 'Task status for your department'}
              </p>
            </div>
            <a
              href={`/tasks/project/${project._id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-white bg-black border border-black px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors flex items-center gap-1.5"
            >
              Open Full View <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleDepartments.map((dept, deptIdx) => {
              const deptTasks = tasks.filter((t) => t.department === dept).sort((a, b) => a.sequence - b.sequence);
              if (deptTasks.length === 0) return null;

              const deptDone = deptTasks.filter((t) => t.status === TaskStatus.DONE).length;
              const deptTotal = deptTasks.length;
              const deptPct = Math.round((deptDone / deptTotal) * 100);
              const blockedCount = deptTasks.filter((t) => t.status === TaskStatus.BLOCKED).length;
              const inProgressCount = deptTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;

              return (
                <div key={dept} className="border border-gray-200 rounded-lg overflow-hidden bg-white flex flex-col">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono font-bold uppercase tracking-widest text-gray-700">
                        {deptIdx + 1}. {departments.find((department) => department.name === dept)?.label || getDepartmentLabel(dept)}
                      </span>
                      <span className="text-[11px] font-black font-mono">{deptPct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          blockedCount > 0 ? 'bg-red-500' : 'bg-black'
                        )}
                        style={{ width: `${deptPct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2.5 mt-1.5 text-[10px] font-mono text-gray-400">
                      <span className="text-green-600 font-bold">{deptDone}</span>/<span>{deptTotal}</span> done
                      {inProgressCount > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                          {inProgressCount} active
                        </span>
                      )}
                      {blockedCount > 0 && (
                        <span className="flex items-center gap-1 text-red-500">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {blockedCount} blocked
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Task list */}
                  <div className="divide-y divide-gray-50 flex-1">
                    {deptTasks.map((task) => (
                      <Link
                        key={task._id}
                        href={`/tasks/${task._id}`}
                        className={cn(
                          'flex items-start gap-2.5 px-4 py-2.5 hover:bg-gray-50 transition-colors group',
                          task.isLocked && 'opacity-40'
                        )}
                      >
                        {/* Status dot */}
                        <div className="mt-0.5 flex-shrink-0">
                          <div className={cn(
                            'w-2.5 h-2.5 rounded-full border-2',
                            task.status === TaskStatus.DONE ? 'bg-green-500 border-green-500' :
                            task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500 border-blue-500' :
                            task.status === TaskStatus.BLOCKED ? 'bg-red-500 border-red-500' :
                            'border-gray-300'
                          )} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'text-xs font-medium leading-tight',
                              task.status === TaskStatus.DONE ? 'text-gray-400 line-through' :
                              task.status === TaskStatus.BLOCKED ? 'text-red-600' :
                              'text-gray-900'
                            )}>
                              {task.title}
                            </span>
                            {task.isLocked && (
                              <span className="text-[9px] font-mono text-gray-300 uppercase tracking-wider">Locked</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {task.assignedUser && typeof task.assignedUser === 'object' && (
                              <span className="text-[9px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                {(task.assignedUser as IUser).name?.split(' ')[0]}
                              </span>
                            )}
                            <TaskStatusBadge status={task.status} size="sm" />
                          </div>
                        </div>

                        <ArrowUpRight className="w-3 h-3 text-gray-300 group-hover:text-gray-600 transition-colors flex-shrink-0 mt-0.5" />
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Raise Alert modal */}
      <Modal open={alertModalOpen} onClose={() => setAlertModalOpen(false)} size="md">
        <CreateAlertForm
          projectId={project._id}
          projectTitle={project.projectTitle}
          title="Raise Global Alert"
          onSuccess={(alert) => {
            setAlerts((prev) => (prev.some((a) => a._id === alert._id) ? prev : [alert, ...prev]));
            setProject((prev) => ({ ...prev, status: ProjectStatus.ON_HOLD }));
            setTasks((prev) =>
              prev.map((task) =>
                alert.affectedDepartments.includes(task.department) &&
                [TaskStatus.TODO, TaskStatus.IN_PROGRESS].includes(task.status)
                  ? { ...task, status: TaskStatus.BLOCKED }
                  : task
              )
            );
            setAlertModalOpen(false);
          }}
          onCancel={() => setAlertModalOpen(false)}
        />
      </Modal>

      {/* Edit Project modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} size="md">
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">Edit Project</h2>
            <button onClick={() => setEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {editError && (
            <div className="flex items-center gap-2 p-3 mb-4 border border-red-300 bg-red-50">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700 font-mono">{editError}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">Person Name</label>
              <input
                type="text"
                value={editForm.clientName}
                onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">Project Title</label>
              <input
                type="text"
                value={editForm.projectTitle}
                onChange={(e) => setEditForm({ ...editForm, projectTitle: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">Description</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">Address</label>
              <input
                type="text"
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">Contact Phone</label>
              <input
                type="tel"
                value={editForm.contactPhone}
                onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">Total Windows</label>
              <input
                type="number"
                value={editForm.totalWindows}
                min={1}
                onChange={(e) => setEditForm({ ...editForm, totalWindows: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">Start Date</label>
              <input
                type="date"
                value={editForm.startDate}
                onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">Deadline</label>
              <input
                type="date"
                value={editForm.deadline}
                onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">End Date</label>
              <input
                type="date"
                value={editForm.endDate}
                onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">Priority</label>
              <div className="grid grid-cols-2 gap-2">
                {([ProjectPriority.STANDARD, ProjectPriority.NECESSARY, ProjectPriority.PRIORITY, ProjectPriority.URGENT] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEditForm({ ...editForm, priority: p })}
                    className={cn(
                      'text-left p-3 border text-xs transition-colors uppercase font-mono font-bold',
                      editForm.priority === p
                        ? p === ProjectPriority.URGENT
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-black bg-black text-white'
                        : 'border-gray-200 hover:border-gray-400 text-gray-600'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 text-xs font-mono font-bold uppercase border border-gray-300 text-gray-600 hover:border-gray-600 hover:text-black transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-xs font-mono font-bold uppercase bg-black text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
            >
              {saving ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ExcelUpload({ onUpload, loading = false }: { onUpload: (file: File) => Promise<void>; loading?: boolean }) {
  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await onUpload(file);
    event.target.value = '';
  };

  return (
    <label className={cn(
      'inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wide border rounded-md cursor-pointer transition-colors',
      loading
        ? 'border-gray-300 text-gray-400 bg-gray-50 pointer-events-none'
        : 'border-gray-200 hover:bg-gray-50'
    )}>
      {loading ? 'Uploading...' : 'Upload Excel'}
      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} disabled={loading} />
    </label>
  );
}