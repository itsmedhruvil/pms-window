'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { cn, apiFetch } from '@/lib/utils';
import { ProjectPriority } from '@/types';
import type { ITemplateGroup } from '@/types';

const PRIORITIES = [
  { value: ProjectPriority.LOW, label: 'Low', desc: 'Standard timeline' },
  { value: ProjectPriority.MEDIUM, label: 'Medium', desc: 'Normal priority' },
  { value: ProjectPriority.HIGH, label: 'High', desc: 'Accelerated schedule' },
  { value: ProjectPriority.URGENT, label: 'Urgent', desc: 'Immediate attention required' },
];

interface FormData {
  clientName: string;
  projectTitle: string;
  priority: ProjectPriority;
  deadline: string;
  address: string;
  contactPhone: string;
  totalWindows: number;
  templateGroupId?: string;
}

interface CreateProjectFormProps {
  onSuccess?: (project: { _id: string; projectTitle: string }) => void;
  onCancel?: () => void;
}

export function CreateProjectForm({ onSuccess, onCancel }: CreateProjectFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    clientName: '',
    projectTitle: '',
    priority: ProjectPriority.MEDIUM,
    deadline: '',
    address: '',
    contactPhone: '',
    totalWindows: 0,
    templateGroupId: undefined,
  });

  const [templateGroups, setTemplateGroups] = useState<ITemplateGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoadingGroups(true);
    apiFetch<ITemplateGroup[]>('/api/template-groups')
      .then((result) => {
        if (!mounted) return;
        setLoadingGroups(false);
        if (result.success && result.data) {
          setTemplateGroups(result.data);
        }
      })
      .catch(() => {
        if (mounted) setLoadingGroups(false);
      });
    return () => { mounted = false; };
  }, []);

  const tomorrowDate = new Date();
  tomorrowDate.setHours(0, 0, 0, 0);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const minDeadline = tomorrowDate.toISOString().split('T')[0];
  const deadlineIsFuture = form.deadline !== '' && new Date(form.deadline) >= tomorrowDate;

  // ── Step validation ──────────────────────────
  const step1Valid =
    form.clientName.trim().length >= 2 &&
    form.projectTitle.trim().length >= 3 &&
    deadlineIsFuture &&
    form.address.trim().length >= 5 &&
    /^\+?[0-9]{7,15}$/.test(form.contactPhone) &&
    form.totalWindows > 0;

  const [dateError, setDateError] = useState<string | null>(null);
  const handleDateChange = (value: string) => {
    setForm({ ...form, deadline: value });
    if (value) {
      const d = new Date(value);
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (d < tomorrow) {
        setDateError('Deadline must be a future date — please select a date from tomorrow onwards');
      } else {
        setDateError(null);
      }
    } else {
      setDateError(null);
    }
  };

  const selectedGroup = templateGroups.find((g) => g._id === form.templateGroupId);

  // ── Submit ────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const body: Record<string, unknown> = {
      clientName: form.clientName,
      projectTitle: form.projectTitle,
      priority: form.priority,
      deadline: form.deadline,
      address: form.address,
      contactPhone: form.contactPhone,
      totalWindows: form.totalWindows,
    };

    // If a template group is selected, pass it along (window specifications will be populated from excel later)
    if (form.templateGroupId) {
      body.selectedTemplateGroupId = form.templateGroupId;
    }

    const result = await apiFetch<{ _id: string; projectTitle: string }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!result.success) {
      setError(typeof result.error === 'string' ? result.error : 'Failed to create project');
      return;
    }

    const projectData = result.data as { _id: string; projectTitle: string };
    if (onSuccess) {
      onSuccess(projectData);
      return;
    }

    router.push(`/projects/${projectData._id}`);
    router.refresh();
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {[
          { n: 1, label: 'Project Details' },
          { n: 2, label: 'Review & Create' },
        ].map(({ n, label }, i, arr) => (
          <div key={n} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div className={cn(
                'w-7 h-7 flex items-center justify-center border-2 font-mono font-bold text-xs flex-shrink-0',
                step > n
                  ? 'bg-black border-black text-white'
                  : step === n
                  ? 'border-black text-black'
                  : 'border-gray-300 text-gray-400'
              )}>
                {step > n ? <Check className="w-3.5 h-3.5" /> : n}
              </div>
              <span className={cn(
                'text-[11px] font-mono uppercase tracking-wide whitespace-nowrap',
                step === n ? 'text-black font-bold' : 'text-gray-400'
              )}>
                {label}
              </span>
            </div>
            {i < arr.length - 1 && (
              <div className={cn(
                'h-px flex-1 mx-3',
                step > n ? 'bg-black' : 'bg-gray-200'
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 border border-red-300 bg-red-50">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-700 font-mono">{error}</p>
        </div>
      )}

      {/* ── Step 1: Project Details ─────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          <SectionHeader title="Project Information" />

          <Field label="Client Name" required>
            <input
              type="text"
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              placeholder="e.g. Sharma Residencies Pvt Ltd"
              className={inputClass}
            />
          </Field>

          <Field label="Project Title" required>
            <input
              type="text"
              value={form.projectTitle}
              onChange={(e) => setForm({ ...form, projectTitle: e.target.value })}
              placeholder="e.g. 4BHK Villa — Block C Windows"
              className={inputClass}
            />
          </Field>

          <Field label="Address" required>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. 123 Main St, City"
              className={inputClass}
            />
          </Field>

          <Field label="Contact Phone" required>
            <input
              type="tel"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              placeholder="e.g. +919876543210"
              className={inputClass}
            />
          </Field>

          {/* New Number of Windows field */}
          <Field label="Number of Windows" required>
            <input
              type="number"
              value={form.totalWindows || ''}
              min={1}
              onChange={(e) => setForm({ ...form, totalWindows: Number(e.target.value) })}
              placeholder="e.g. 100"
              className={inputClass}
            />
            <p className="mt-1 text-[10px] font-mono text-gray-400">
              Window specifications (sizes, designs, glass types) can be uploaded later via Excel in the project detail view.
            </p>
          </Field>

          <Field label="Deadline" required>
            <input
              type="date"
              value={form.deadline}
              min={minDeadline}
              onChange={(e) => handleDateChange(e.target.value)}
              className={inputClass}
            />
            {dateError && (
              <p className="mt-1 text-[10px] font-mono text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {dateError}
              </p>
            )}
          </Field>

          <Field label="Priority" required>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setForm({ ...form, priority: p.value })}
                  className={cn(
                    'text-left p-3 border text-xs transition-colors',
                    form.priority === p.value
                      ? p.value === ProjectPriority.URGENT
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-black bg-black text-white'
                      : 'border-gray-200 hover:border-gray-400'
                  )}
                >
                  <p className="font-mono font-bold uppercase tracking-wide">{p.label}</p>
                  <p className={cn(
                    'text-[10px] mt-0.5',
                    form.priority === p.value ? 'opacity-70' : 'text-gray-500'
                  )}>
                    {p.desc}
                  </p>
                </button>
              ))}
            </div>
          </Field>

          {/* Task Template Group */}
          <div className="border border-gray-200 p-4 bg-blue-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-700">
                Task Template Group (optional)
              </span>
              {loadingGroups && <span className="text-[10px] text-gray-400 font-mono">Loading...</span>}
            </div>
            <p className="text-xs text-gray-600 font-mono mb-3">
              Select a template group to automatically generate department tasks. Tasks will be allocated directly to departments after project creation.
            </p>
            <select
              value={form.templateGroupId || ''}
              onChange={(e) => setForm({ ...form, templateGroupId: e.target.value || undefined })}
              className="w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors bg-white"
            >
              <option value="">No template group (use default tasks)</option>
              {templateGroups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}{g.description ? ` — ${g.description}` : ''}
                </option>
              ))}
            </select>
            {selectedGroup && (
              <div className="mt-2 text-[10px] text-gray-600 font-mono">
                ✓ {selectedGroup.tasks.length} tasks across{' '}
                {new Set(selectedGroup.tasks.map((t) => t.department)).size} departments will be created
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2: Review ────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          <SectionHeader title="Order Summary" />

          <ReviewBlock label="Client">{form.clientName}</ReviewBlock>
          <ReviewBlock label="Project">{form.projectTitle}</ReviewBlock>
          <ReviewBlock label="Address">{form.address}</ReviewBlock>
          <ReviewBlock label="Contact">{form.contactPhone}</ReviewBlock>
          <ReviewBlock label="Total Windows">
            <span className="font-bold">{form.totalWindows}</span>
          </ReviewBlock>
          <ReviewBlock label="Priority">
            <span className={cn(
              'font-mono font-bold uppercase text-xs',
              form.priority === ProjectPriority.URGENT ? 'text-red-600' : ''
            )}>
              {form.priority}
            </span>
          </ReviewBlock>
          <ReviewBlock label="Deadline">
            {new Date(form.deadline).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </ReviewBlock>

          {selectedGroup && (
            <div className="border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-600 font-mono">
                <span className="font-bold text-gray-900">After creation:</span> {' '}
                tasks from &ldquo;{selectedGroup.name}&rdquo; template group will be generated across departments.
                Window specifications can be uploaded via Excel in the project details.
              </p>
            </div>
          )}

          {!selectedGroup && (
            <div className="border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-600 font-mono">
                <span className="font-bold text-gray-900">After creation:</span> {' '}
                active task templates will be copied department-wise into this project.
                Window specifications can be uploaded via Excel in the project details.
              </p>
            </div>
          )}

          <div className="border border-gray-200 bg-amber-50 p-4">
            <p className="text-xs text-gray-700 font-mono">
              <span className="font-bold">Note:</span> Window specifications (sizes, designs, glass types) will be uploaded
              via an Excel file after project creation. Navigate to the project detail page to upload.
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-200">
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-mono font-bold uppercase border border-gray-300 text-gray-600 hover:border-gray-600 hover:text-black transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase border border-gray-300 text-gray-600 hover:border-gray-600 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>
        </div>

        {step < 2 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!step1Valid}
            className="flex items-center gap-2 px-5 py-2 text-xs font-mono font-bold uppercase bg-black text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Continue
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 text-xs font-mono font-bold uppercase bg-black text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
          >
            {loading ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Create Order
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({
  label, required, children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="pb-2 border-b border-gray-200">
      <h2 className="text-sm font-black text-gray-900">{title}</h2>
    </div>
  );
}

function ReviewBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400 w-28 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-xs text-gray-900">{children}</span>
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors bg-white placeholder:text-gray-400';