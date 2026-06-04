'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronRight, ChevronLeft, Check, X, FileText, Upload } from 'lucide-react';
import { cn, apiFetch } from '@/lib/utils';
import { ProjectPriority } from '@/types';
import type { ITemplateGroup } from '@/types';

const PRIORITIES = [
  { value: ProjectPriority.STANDARD, label: 'Standard', desc: 'Standard timeline' },
  { value: ProjectPriority.NECESSARY, label: 'Necessary', desc: 'Normal priority' },
  { value: ProjectPriority.PRIORITY, label: 'Priority', desc: 'Accelerated schedule' },
  { value: ProjectPriority.URGENT, label: 'Urgent', desc: 'Immediate attention required' },
];

const PRODUCT_TYPE_OPTIONS = [
  'Aluminium Sliding Windows',
  'Aluminium Doors',
  'Casement Window',
  'Glass Slim Partitions',
  'Aluminium Glass Railing',
  'Curtain Wall Systems',
];

interface PdfFile {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
}

interface FormData {
  clientName: string;
  projectTitle: string;
  description: string;
  priority: ProjectPriority;
  startDate: string;
  deadline: string;
  address: string;
  contactPhone: string;
  totalWindows: number;
  templateGroupId?: string;
  productTypes: string[];
  tags: string[];
  windowDesigns: Array<{
    design: string;
    pdf?: PdfFile;
  }>;
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
    description: '',
    priority: ProjectPriority.NECESSARY,
    startDate: '',
    deadline: '',
    address: '',
    contactPhone: '',
    totalWindows: 0,
    templateGroupId: undefined,
    productTypes: [],
    tags: [],
    windowDesigns: [],
  });

  const [tagInput, setTagInput] = useState('');

  // ── Inline field-level alerts ──────────────────────
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  const fieldErrors: Record<string, string | null> = {};
  if (touched['projectTitle']) {
    if (!form.projectTitle.trim()) {
      fieldErrors['projectTitle'] = 'Project title is required.';
    } else if (form.projectTitle.trim().length < 3) {
      fieldErrors['projectTitle'] = 'Project title must be at least 3 characters.';
    }
  }
  if (touched['address']) {
    if (!form.address.trim()) {
      fieldErrors['address'] = 'Address is required.';
    } else if (form.address.trim().length < 5) {
      fieldErrors['address'] = 'Address must be at least 5 characters.';
    }
  }
  if (touched['totalWindows']) {
    if (form.totalWindows <= 0) {
      fieldErrors['totalWindows'] = 'Number of products must be greater than 0.';
    }
  }
  if (touched['deadline']) {
    if (!form.deadline) {
      fieldErrors['deadline'] = 'Deadline is required.';
    }
  }
  if (touched['contactPhone'] && form.contactPhone.trim()) {
    const phoneClean = form.contactPhone.trim().replace(/[\s\-\(\)]/g, '');
    if (!/^\+?\d{7,15}$/.test(phoneClean)) {
      fieldErrors['contactPhone'] = 'Enter a valid phone number (7–15 digits, optional + prefix).';
    }
  }

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
    form.projectTitle.trim().length >= 3 &&
    deadlineIsFuture &&
    form.address.trim().length >= 5 &&
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

  const toggleProductType = (type: string) => {
    setForm({
      ...form,
      productTypes: form.productTypes.includes(type)
        ? form.productTypes.filter((t) => t !== type)
        : [...form.productTypes, type],
    });
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !form.tags.includes(trimmed)) {
      setForm({ ...form, tags: [...form.tags, trimmed] });
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setForm({ ...form, tags: form.tags.filter((t) => t !== tag) });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  // Window design upload
  const handleDesignPdfUpload = async (index: number, file: File) => {
    if (file.type !== 'application/pdf') return;

    const formData = new FormData();
    formData.append('file', file);
    const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
    const uploadData = await uploadRes.json();

    if (!uploadData.success) return;

    const pdfFile: PdfFile = {
      id: `${Date.now()}-${index}`,
      name: uploadData.data.name,
      url: uploadData.data.url,
      size: uploadData.data.size,
      uploadedAt: new Date().toISOString(),
    };

    const newDesigns = [...form.windowDesigns];
    newDesigns[index] = { ...newDesigns[index], pdf: pdfFile };
    setForm({ ...form, windowDesigns: newDesigns });
  };

  const removeDesignPdf = (index: number) => {
    const newDesigns = [...form.windowDesigns];
    delete newDesigns[index].pdf;
    setForm({ ...form, windowDesigns: newDesigns });
  };

  // Generate window design rows based on totalWindows
  const windowDesignCount = Math.min(form.totalWindows, 20); // Limit to 20 rows in form
  const windowDesigns = Array.from({ length: windowDesignCount }, (_, i) => ({
    index: i,
    label: `Design ${i + 1}`,
    data: form.windowDesigns[i] || { design: '' },
  }));

  const updateWindowDesign = (index: number, design: string) => {
    const newDesigns = [...form.windowDesigns];
    if (!newDesigns[index]) {
      newDesigns[index] = { design: '' };
    }
    newDesigns[index] = { ...newDesigns[index], design };
    setForm({ ...form, windowDesigns: newDesigns });
  };

  const selectedGroup = templateGroups.find((g) => g._id === form.templateGroupId);

  // ── Submit ────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const body: Record<string, unknown> = {
      projectTitle: form.projectTitle,
      priority: form.priority,
      deadline: form.deadline,
      address: form.address,
      totalWindows: form.totalWindows,
      productTypes: form.productTypes,
      tags: form.tags,
    };

    if (form.clientName.trim()) {
      body.clientName = form.clientName.trim();
    }

    if (form.contactPhone.trim()) {
      body.contactPhone = form.contactPhone.trim();
    }

    if (form.description.trim()) {
      body.description = form.description.trim();
    }

    if (form.startDate.trim()) {
      body.startDate = form.startDate.trim();
    }

    if (form.templateGroupId) {
      body.selectedTemplateGroupId = form.templateGroupId;
    }

    // Build window specifications from designs
    const specs = form.windowDesigns
      .filter((wd) => wd.design?.trim())
      .map((wd) => {
        const designCount = Math.ceil(form.totalWindows / windowDesignCount);
        const spec: Record<string, unknown> = {
          width: 0,
          height: 0,
          design: wd.design.trim(),
          glassType: '',
          quantity: designCount,
        };
        if (wd.pdf) {
          spec.designPdf = wd.pdf;
        }
        return spec;
      });

    if (specs.length > 0) {
      body.windowSpecifications = specs;
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
    <div>
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

          <Field label="Person Name (Optional)">
            <input
              type="text"
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              placeholder="e.g. Sharma Residencies Pvt Ltd"
              className={inputClass}
            />
            <p className="mt-1 text-[10px] font-mono text-gray-400">Client/person name (optional)</p>
          </Field>

          <Field label="Project Title" required>
            <input
              type="text"
              value={form.projectTitle}
              onChange={(e) => { setForm({ ...form, projectTitle: e.target.value }); markTouched('projectTitle'); }}
              onBlur={() => markTouched('projectTitle')}
              placeholder="e.g. 4BHK Villa — Block C Windows"
              className={inputClass}
            />
            {fieldErrors['projectTitle'] && (
              <p className="mt-1 text-[10px] font-mono text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {fieldErrors['projectTitle']}
              </p>
            )}
          </Field>

          <Field label="Project Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of the project scope, requirements, or special instructions..."
              rows={3}
              className="w-full text-xs font-mono border border-gray-200 px-3 py-2 focus:outline-none focus:border-black transition-colors resize-none placeholder:text-gray-400"
            />
          </Field>

          <Field label="Address" required>
            <input
              type="text"
              value={form.address}
              onChange={(e) => { setForm({ ...form, address: e.target.value }); markTouched('address'); }}
              onBlur={() => markTouched('address')}
              placeholder="e.g. 123 Main St, City"
              className={inputClass}
            />
            {fieldErrors['address'] && (
              <p className="mt-1 text-[10px] font-mono text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {fieldErrors['address']}
              </p>
            )}
          </Field>

          <Field label="Contact Phone">
            <input
              type="tel"
              value={form.contactPhone}
              onChange={(e) => { setForm({ ...form, contactPhone: e.target.value }); markTouched('contactPhone'); }}
              onBlur={() => markTouched('contactPhone')}
              placeholder="e.g. +919876543210 (optional)"
              className={inputClass}
            />
            {fieldErrors['contactPhone'] && (
              <p className="mt-1 text-[10px] font-mono text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {fieldErrors['contactPhone']}
              </p>
            )}
          </Field>

          <Field label="Number of Products" required>
            <input
              type="number"
              value={form.totalWindows || ''}
              min={1}
              onChange={(e) => { setForm({ ...form, totalWindows: Number(e.target.value) }); markTouched('totalWindows'); }}
              onBlur={() => markTouched('totalWindows')}
              placeholder="e.g. 100"
              className={inputClass}
            />
            {fieldErrors['totalWindows'] && (
              <p className="mt-1 text-[10px] font-mono text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {fieldErrors['totalWindows']}
              </p>
            )}
          </Field>

          {/* Window Designs Section */}
          {form.totalWindows > 0 && (
            <div className="border border-gray-200 p-4 bg-gray-50">
              <SectionHeader title="Window Designs (Optional)" />
              <p className="text-[10px] font-mono text-gray-400 mt-1 mb-3">
                Optionally specify up to {windowDesignCount} design names and upload PDF drawings.
              </p>
              <div className="space-y-3">
                {windowDesigns.map(({ index, label, data }) => (
                  <div key={index} className="flex items-start gap-2">
                    <input
                      type="text"
                      value={data.design}
                      onChange={(e) => updateWindowDesign(index, e.target.value)}
                      placeholder={`${label} name`}
                      className="flex-1 px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors"
                    />
                    <div className="flex-shrink-0">
                      <input
                        type="file"
                        accept=".pdf"
                        id={`design-pdf-${index}`}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleDesignPdfUpload(index, file);
                          e.target.value = '';
                        }}
                      />
                      {data.pdf ? (
                        <div className="flex items-center gap-1">
                          <a
                            href={data.pdf.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-mono text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                          >
                            <FileText className="w-3 h-3" />
                            PDF
                          </a>
                          <button
                            type="button"
                            onClick={() => removeDesignPdf(index)}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label
                          htmlFor={`design-pdf-${index}`}
                          className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-mono text-gray-500 border border-dashed border-gray-300 rounded cursor-pointer hover:border-gray-500"
                        >
                          <Upload className="w-3 h-3" />
                          PDF
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Field label="Start Date">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Deadline" required>
            <input
              type="date"
              value={form.deadline}
              min={minDeadline}
              onChange={(e) => { handleDateChange(e.target.value); markTouched('deadline'); }}
              onBlur={() => markTouched('deadline')}
              className={inputClass}
            />
            {fieldErrors['deadline'] && (
              <p className="mt-1 text-[10px] font-mono text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {fieldErrors['deadline']}
              </p>
            )}
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

          {/* Product Types - Multi Select */}
          <Field label="Product Types">
            <div className="flex flex-wrap gap-2">
              {PRODUCT_TYPE_OPTIONS.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleProductType(type)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wide border transition-colors rounded',
                    form.productTypes.includes(type)
                      ? 'bg-black text-white border-black'
                      : 'border-gray-200 text-gray-500 hover:border-gray-400'
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
            {form.productTypes.length > 0 && (
              <p className="mt-1 text-[10px] font-mono text-gray-400">
                Selected: {form.productTypes.join(', ')}
              </p>
            )}
          </Field>

          {/* Tags */}
          <Field label="Tags">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Type a tag and press Enter"
                className="flex-1 px-3 py-2 text-xs font-mono border border-gray-200 focus:outline-none focus:border-black transition-colors"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 text-xs font-mono font-bold uppercase border border-gray-200 text-gray-600 hover:border-black hover:text-black transition-colors"
              >
                Add
              </button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-700 rounded"
                  >
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="text-gray-400 hover:text-red-500">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
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
              Select a template group to automatically generate department tasks.
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

          {form.clientName && (
            <ReviewBlock label="Person">{form.clientName}</ReviewBlock>
          )}
          <ReviewBlock label="Project">{form.projectTitle}</ReviewBlock>
          {form.description && (
            <ReviewBlock label="Description">
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{form.description}</p>
            </ReviewBlock>
          )}
          <ReviewBlock label="Address">{form.address}</ReviewBlock>
          {form.contactPhone && (
            <ReviewBlock label="Contact">{form.contactPhone}</ReviewBlock>
          )}
          <ReviewBlock label="Total Products">
            <span className="font-bold">{form.totalWindows}</span>
          </ReviewBlock>

          {/* Window Designs Review */}
          {form.windowDesigns.filter((wd) => wd.design?.trim()).length > 0 && (
            <ReviewBlock label="Window Designs">
              <div className="space-y-1">
                {form.windowDesigns
                  .filter((wd) => wd.design?.trim())
                  .map((wd, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{wd.design}</span>
                      {wd.pdf && (
                        <a href={wd.pdf.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-[10px]">
                          (PDF)
                        </a>
                      )}
                    </div>
                  ))}
              </div>
            </ReviewBlock>
          )}

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

          {form.productTypes.length > 0 && (
            <ReviewBlock label="Products">
              <div className="flex flex-wrap gap-1">
                {form.productTypes.map((pt) => (
                  <span key={pt} className="px-2 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-700 rounded">
                    {pt}
                  </span>
                ))}
              </div>
            </ReviewBlock>
          )}

          {form.tags.length > 0 && (
            <ReviewBlock label="Tags">
              <div className="flex flex-wrap gap-1">
                {form.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-700 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </ReviewBlock>
          )}

          {selectedGroup && (
            <div className="border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-600 font-mono">
                <span className="font-bold text-gray-900">After creation:</span> {' '}
                tasks from &ldquo;{selectedGroup.name}&rdquo; template group will be generated across departments.
              </p>
            </div>
          )}

          {!selectedGroup && (
            <div className="border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-600 font-mono">
                <span className="font-bold text-gray-900">After creation:</span> {' '}
                active task templates will be copied department-wise into this project.
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