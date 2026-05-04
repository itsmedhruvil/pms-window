'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, AlertCircle, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { cn, apiFetch } from '@/lib/utils';
import { ProjectPriority } from '@/types';
import type { WindowSpec, ITemplateGroup } from '@/types';

const PRIORITIES = [
  { value: ProjectPriority.LOW, label: 'Low', desc: 'Standard timeline' },
  { value: ProjectPriority.MEDIUM, label: 'Medium', desc: 'Normal priority' },
  { value: ProjectPriority.HIGH, label: 'High', desc: 'Accelerated schedule' },
  { value: ProjectPriority.URGENT, label: 'Urgent', desc: 'Immediate attention required' },
];

const GLASS_TYPES = [
  'Clear Float', 'Tinted', 'Tempered', 'Laminated',
  'Double Glazed', 'Triple Glazed', 'Frosted', 'Low-E',
];

const DESIGNS = [
  'Casement', 'Sliding', 'Fixed', 'Awning',
  'Tilt & Turn', 'Bay', 'Bow', 'Skylight',
];

interface FormData {
  clientName: string;
  projectTitle: string;
  priority: ProjectPriority;
  deadline: string;
  windowSpecifications: WindowSpec[];
}

const EMPTY_SPEC: WindowSpec = {
  width: 0,
  height: 0,
  design: '',
  glassType: '',
  quantity: 1,
  notes: '',
};

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
    // new fields
    address: '',
    contactPhone: '',
    budget: 0,
    windowSpecifications: [{ ...EMPTY_SPEC }],
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

  const totalWindows = form.windowSpecifications.reduce((s, sp) => s + (sp.quantity || 0), 0);

  // ── Step validation ──────────────────────────
  const step1Valid =
    form.clientName.trim().length >= 2 &&
    form.projectTitle.trim().length >= 3 &&
    form.deadline !== '' &&
    form.address.trim().length >= 5 &&
    /^\+?[0-9]{7,15}$/.test(form.contactPhone) &&
    form.budget > 0;

  const step2Valid = form.windowSpecifications.every(
    (s) => s.width > 0 && s.height > 0 && s.design && s.glassType && s.quantity >= 1
  );

  // ── Spec helpers ─────────────────────────────
  const addSpec = () =>
    setForm((f) => ({
      ...f,
      windowSpecifications: [...f.windowSpecifications, { ...EMPTY_SPEC }],
    }));

  const removeSpec = (idx: number) =>
    setForm((f) => ({
      ...f,
      windowSpecifications: f.windowSpecifications.filter((_, i) => i !== idx),
    }));

  const updateSpec = (idx: number, key: keyof WindowSpec, value: string | number) =>
    setForm((f) => {
      const specs = [...f.windowSpecifications];
      specs[idx] = { ...specs[idx], [key]: value };
      return { ...f, windowSpecifications: specs };
    });

  const selectedGroup = templateGroups.find((g) => g._id === form.windowSpecifications[0]?.templateGroupId);

  // ── Submit ────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const result = await apiFetch<{ _id: string; projectTitle: string }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ ...form, totalWindows }),
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
          { n: 1, label: 'Order Details' },
          { n: 2, label: 'Specifications' },
          { n: 3, label: 'Review' },
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

      {/* ── Step 1: Order Details ─────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          <SectionHeader title="Client & Order Information" />

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

          <Field label="Deadline" required>
            <input
              type="date"
              value={form.deadline}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className={inputClass}
            />
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
        </div>
      )}

      {/* ── Step 2: Window Specs ──────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeader title="Window Specifications" />
            <span className="text-xs font-mono text-gray-500">
              Total: <span className="font-bold text-gray-900">{totalWindows}</span> windows
            </span>
          </div>

          {/* New Project Detail Fields */}
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
          <Field label="Budget (₹)" required>
            <input
              type="number"
              value={form.budget}
              min={0}
              onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })}
              placeholder="e.g. 500000"
              className={inputClass}
            />
          </Field>
          {/* Template Group selector (applied to all specs) */}
          <div className="border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
                Task Template Group
              </span>
              {loadingGroups && <span className="text-[10px] text-gray-400 font-mono">Loading...</span>}
            </div>
            <p className="text-[11px] text-gray-500 font-mono mb-3">
              Select a template group to auto-generate department tasks for each window type.
            </p>
            <select
              value={selectedGroup?._id || ''}
              onChange={(e) => {
                const groupId = e.target.value;
                setForm((f) => ({
                  ...f,
                  windowSpecifications: f.windowSpecifications.map((s) => ({
                    ...s,
                    templateGroupId: groupId || undefined,
                  })),
                }));
              }}
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
              <div className="mt-2 text-[10px] text-gray-500 font-mono">
                {selectedGroup.tasks.length} tasks across{' '}
                {new Set(selectedGroup.tasks.map((t) => t.department)).size} departments
              </div>
            )}
          </div>

          {form.windowSpecifications.map((spec, idx) => (
            <SpecRow
              key={idx}
              spec={spec}
              index={idx}
              canRemove={form.windowSpecifications.length > 1}
              onUpdate={(key, val) => updateSpec(idx, key, val)}
              onRemove={() => removeSpec(idx)}
            />
          ))}

          <button
            type="button"
            onClick={addSpec}
            className="w-full py-2.5 border-2 border-dashed border-gray-300 text-xs font-mono text-gray-500 hover:border-gray-500 hover:text-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Window Type
          </button>
        </div>
      )}

      {/* ── Step 3: Review ────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <SectionHeader title="Order Summary" />

          <ReviewBlock label="Client">{form.clientName}</ReviewBlock>
          <ReviewBlock label="Project">{form.projectTitle}</ReviewBlock>
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
          <ReviewBlock label="Total Windows">{totalWindows}</ReviewBlock>

          <div className="border border-gray-200 divide-y divide-gray-100">
            <div className="px-3 py-2 bg-gray-50">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
                Window Specifications
              </span>
            </div>
            {form.windowSpecifications.map((spec, i) => (
              <div key={i} className="px-3 py-2.5 flex items-center gap-4 text-xs">
                <span className="font-mono text-gray-400 w-5">#{i + 1}</span>
                <span className="font-mono font-bold text-gray-900">{spec.width}×{spec.height}mm</span>
                <span className="text-gray-600">{spec.design}</span>
                <span className="text-gray-500">{spec.glassType}</span>
                <span className="ml-auto font-bold">×{spec.quantity}</span>
              </div>
            ))}
          </div>

          {selectedGroup && (
            <div className="border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-600 font-mono">
                <span className="font-bold text-gray-900">After creation:</span> {' '}
                each window will generate tasks from &ldquo;{selectedGroup.name}&rdquo; template group &times; quantity.
              </p>
            </div>
          )}

          {!selectedGroup && (
            <div className="border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-600 font-mono">
                <span className="font-bold text-gray-900">After creation:</span> {' '}
                active task templates will be copied department-wise into this project,
                with each generated task keeping a reference to its source template.
              </p>
            </div>
          )}
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

        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 1 ? !step1Valid : !step2Valid}
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

function SpecRow({
  spec, index, canRemove, onUpdate, onRemove,
}: {
  spec: WindowSpec;
  index: number;
  canRemove: boolean;
  onUpdate: (key: keyof WindowSpec, val: string | number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">
          Window Type #{index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-gray-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Width (mm)" required compact>
          <input
            type="number"
            value={spec.width || ''}
            min={1}
            onChange={(e) => onUpdate('width', Number(e.target.value))}
            className={inputClass}
            placeholder="e.g. 1200"
          />
        </Field>
        <Field label="Height (mm)" required compact>
          <input
            type="number"
            value={spec.height || ''}
            min={1}
            onChange={(e) => onUpdate('height', Number(e.target.value))}
            className={inputClass}
            placeholder="e.g. 900"
          />
        </Field>
        <Field label="Design" required compact>
          <select
            value={spec.design}
            onChange={(e) => onUpdate('design', e.target.value)}
            className={inputClass}
          >
            <option value="">Select design</option>
            {DESIGNS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Glass Type" required compact>
          <select
            value={spec.glassType}
            onChange={(e) => onUpdate('glassType', e.target.value)}
            className={inputClass}
          >
            <option value="">Select glass</option>
            {GLASS_TYPES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Quantity" required compact>
          <input
            type="number"
            value={spec.quantity || ''}
            min={1}
            onChange={(e) => onUpdate('quantity', Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Notes" compact>
          <input
            type="text"
            value={spec.notes || ''}
            onChange={(e) => onUpdate('notes', e.target.value)}
            className={inputClass}
            placeholder="Optional"
          />
        </Field>
      </div>
    </div>
  );
}

function Field({
  label, required, compact, children,
}: {
  label: string;
  required?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={compact ? '' : 'space-y-1.5'}>
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