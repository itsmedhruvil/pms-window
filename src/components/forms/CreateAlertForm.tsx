'use client';

import { useState } from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';
import { cn, apiFetch, ALERT_TYPE_LABEL, DEPARTMENT_LABELS } from '@/lib/utils';
import { AlertType, AlertSeverity, Department } from '@/types';

interface CreateAlertFormProps {
  projectId: string;
  projectTitle: string;
  taskId?: string;
  defaultAffectedDepartments?: Department[];
  title?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateAlertForm({
  projectId,
  projectTitle,
  taskId,
  defaultAffectedDepartments = [],
  title = 'Raise Alert',
  onSuccess,
  onCancel,
}: CreateAlertFormProps) {
  const [form, setForm] = useState({
    type: '' as AlertType | '',
    severity: '' as AlertSeverity | '',
    message: '',
    affectedDepartments: defaultAffectedDepartments,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    form.type &&
    form.severity &&
    form.message.trim().length >= 10 &&
    form.affectedDepartments.length > 0;

  const toggleDept = (dept: Department) =>
    setForm((f) => ({
      ...f,
      affectedDepartments: f.affectedDepartments.includes(dept)
        ? f.affectedDepartments.filter((d) => d !== dept)
        : [...f.affectedDepartments, dept],
    }));

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError(null);

    const result = await apiFetch('/api/alerts', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        type: form.type,
        severity: form.severity,
        message: form.message.trim(),
        affectedDepartments: form.affectedDepartments,
        ...(taskId && { taskId }),
      }),
    });

    setLoading(false);

    if (!result.success) {
      setError(typeof result.error === 'string' ? result.error : 'Failed to raise alert');
      return;
    }

    onSuccess?.();
  };

  return (
    <div className="bg-white border border-red-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-red-600">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-white" />
          <span className="text-sm font-mono font-bold text-white uppercase tracking-wide">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-red-200 font-mono truncate max-w-[200px]">
            {projectTitle}
          </span>
          {onCancel && (
            <button onClick={onCancel} className="text-red-200 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Warning notice */}
        <div className="bg-red-50 border border-red-200 px-3 py-2.5">
          <p className="text-[11px] text-red-700 font-mono leading-relaxed">
            <span className="font-bold">WARNING:</span>{' '}
            {taskId
              ? 'Raising a task alert will put the project on hold and block this task until the alert is resolved.'
              : 'Raising a global alert will put the project on hold, block tasks in affected departments, and require resolution before work can resume.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 px-3 py-2">
            <p className="text-xs text-red-700 font-mono">{error}</p>
          </div>
        )}

        {/* Alert Type */}
        <div className="space-y-2">
          <label className={labelClass}>Alert Type <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(AlertType).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm({ ...form, type })}
                className={cn(
                  'text-left px-3 py-2.5 border text-xs font-mono transition-colors',
                  form.type === type
                    ? 'border-red-500 bg-red-50 text-red-700 font-bold'
                    : 'border-gray-200 text-gray-700 hover:border-gray-400'
                )}
              >
                {ALERT_TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div className="space-y-2">
          <label className={labelClass}>Severity <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {[AlertSeverity.HIGH, AlertSeverity.CRITICAL].map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setForm({ ...form, severity: sev })}
                className={cn(
                  'px-3 py-2.5 border text-xs font-mono font-bold uppercase tracking-wide transition-colors',
                  form.severity === sev
                    ? sev === AlertSeverity.CRITICAL
                      ? 'border-red-700 bg-red-600 text-white'
                      : 'border-red-400 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                )}
              >
                {sev === AlertSeverity.CRITICAL ? '▲ CRITICAL' : '▲ HIGH'}
              </button>
            ))}
          </div>
        </div>

        {/* Affected departments */}
        <div className="space-y-2">
          <label className={labelClass}>
            Affected Departments <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(Department).map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => toggleDept(dept)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 border text-[11px] font-mono transition-colors',
                  form.affectedDepartments.includes(dept)
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                )}
              >
                <div className={cn(
                  'w-3.5 h-3.5 border flex items-center justify-center flex-shrink-0',
                  form.affectedDepartments.includes(dept)
                    ? 'border-white bg-white'
                    : 'border-gray-400'
                )}>
                  {form.affectedDepartments.includes(dept) && (
                    <Check className="w-2.5 h-2.5 text-black" />
                  )}
                </div>
                {DEPARTMENT_LABELS[dept]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setForm({
                ...form,
                affectedDepartments:
                  form.affectedDepartments.length === Object.values(Department).length
                    ? []
                    : Object.values(Department),
              })
            }
            className="text-[10px] font-mono text-gray-500 hover:text-black underline"
          >
            {form.affectedDepartments.length === Object.values(Department).length
              ? 'Deselect all'
              : 'Select all departments'}
          </button>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <label className={labelClass}>
            Alert Message <span className="text-red-500">*</span>
            <span className="normal-case font-normal text-gray-400 ml-2">(min 10 characters)</span>
          </label>
          <textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={4}
            placeholder="Describe the issue in detail. Include what happened, impact, and any immediate actions required..."
            className="w-full px-3 py-2.5 text-xs font-mono border border-gray-200 focus:outline-none focus:border-red-400 transition-colors resize-none placeholder:text-gray-400"
          />
          <div className="flex justify-between">
            <span className="text-[10px] text-gray-400 font-mono">
              {form.message.length} chars
            </span>
            {form.message.length < 10 && form.message.length > 0 && (
              <span className="text-[10px] text-red-500 font-mono">
                {10 - form.message.length} more characters needed
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-mono font-bold uppercase border border-gray-300 text-gray-600 hover:border-gray-600 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className={cn(
              'flex items-center gap-2 px-5 py-2 text-xs font-mono font-bold uppercase transition-colors',
              isValid && !loading
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            {loading ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Raising...
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                {title}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelClass = 'block text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500';
