'use client';

import { useState, useMemo } from 'react';
import { Factory, Building2, Check, Loader2 } from 'lucide-react';
import { cn, apiFetch } from '@/lib/utils';
import { notifyDepartmentsChanged } from '@/hooks/useDepartments';
import { FactoryGroup, FACTORY_GROUP_LABELS, DEPARTMENT_LABELS, STAGE_SEQUENCE, STAGE_LABELS, STAGE_TASK_CATEGORIES, formatStageName } from '@/types';

interface DepartmentItem {
  _id: string;
  name: string;
  label: string;
  abbreviation: string;
  sequence: number;
  description: string;
  isActive: boolean;
  factoryGroup: FactoryGroup;
}

interface SettingsClientProps {
  initialDepartments: DepartmentItem[];
}

export function SettingsClient({ initialDepartments }: SettingsClientProps) {
  const [departments, setDepartments] = useState<DepartmentItem[]>(initialDepartments);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sorted = useMemo(() => [...departments].sort((a, b) => a.sequence - b.sequence), [departments]);

  const insideCount = useMemo(
    () => departments.filter((d) => d.factoryGroup === FactoryGroup.INSIDE).length,
    [departments]
  );
  const outsideCount = useMemo(
    () => departments.filter((d) => d.factoryGroup === FactoryGroup.OUTSIDE).length,
    [departments]
  );

  const changeFactoryGroup = async (dept: DepartmentItem, newGroup: FactoryGroup) => {
    if (dept.factoryGroup === newGroup) return;
    setSavingId(dept._id);
    setError(null);
    setSuccess(null);

    const result = await apiFetch(`/api/departments/${dept._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ factoryGroup: newGroup }),
    });

    setSavingId(null);

    if (result.success) {
      setDepartments((prev) =>
        prev.map((d) => (d._id === dept._id ? { ...d, factoryGroup: newGroup } : d))
      );
      setSuccess(`"${dept.label}" is now ${FACTORY_GROUP_LABELS[newGroup]}`);
      notifyDepartmentsChanged();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || 'Failed to update department');
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-primary-200">
        <div>
          <h1 className="text-xl font-black text-dark-500">Settings</h1>
          <p className="text-xs text-primary-500 font-mono mt-0.5">
            Configure factory group assignments for departments
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="border border-primary-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-dark-500 flex items-center justify-center flex-shrink-0">
            <Factory className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary-500">
              Inside Factory
            </p>
            <p className="text-lg font-black text-dark-500">{insideCount} department{insideCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="border border-primary-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-200 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-dark-500" />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary-500">
              Outside Factory
            </p>
            <p className="text-lg font-black text-dark-500">{outsideCount} department{outsideCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-xs">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 rounded border border-green-200 bg-green-50 text-green-700 text-xs">
          {success}
        </div>
      )}

      {/* Department factory group configuration */}
      <div className="border border-primary-200">
        <div className="px-4 py-3 border-b border-primary-200 bg-primary-50">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-dark-600">
            Department Factory Group Assignment
          </h2>
          <p className="text-[10px] text-primary-500 font-mono mt-0.5">
            Select which departments work inside the factory vs outside. This determines how projects are categorized.
          </p>
        </div>

        <div className="divide-y divide-primary-100">
          {sorted.map((dept) => (
            <div key={dept._id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-mono font-bold text-dark-500">
                    {dept.abbreviation}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-dark-500 truncate">{dept.label}</p>
                  <p className="text-[10px] font-mono text-primary-400 truncate">{dept.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => changeFactoryGroup(dept, FactoryGroup.INSIDE)}
                  disabled={savingId === dept._id}
                  className={cn(
                    'px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors disabled:opacity-50',
                    dept.factoryGroup === FactoryGroup.INSIDE
                      ? 'bg-dark-500 text-white border-dark-500'
                      : 'border-primary-200 text-primary-500 hover:border-dark-500 hover:text-dark-500'
                  )}
                >
                  {savingId === dept._id ? (
                    <Loader2 className="w-3 h-3 inline animate-spin" />
                  ) : dept.factoryGroup === FactoryGroup.INSIDE ? (
                    <Check className="w-3 h-3 inline mr-1" />
                  ) : null}
                  Inside
                </button>
                <button
                  type="button"
                  onClick={() => changeFactoryGroup(dept, FactoryGroup.OUTSIDE)}
                  disabled={savingId === dept._id}
                  className={cn(
                    'px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors disabled:opacity-50',
                    dept.factoryGroup === FactoryGroup.OUTSIDE
                      ? 'bg-primary-200 text-dark-600 border-primary-300'
                      : 'border-primary-200 text-primary-500 hover:border-dark-500 hover:text-dark-500'
                  )}
                >
                  {savingId === dept._id ? (
                    <Loader2 className="w-3 h-3 inline animate-spin" />
                  ) : dept.factoryGroup === FactoryGroup.OUTSIDE ? (
                    <Check className="w-3 h-3 inline mr-1" />
                  ) : null}
                  Outside
                </button>
              </div>
            </div>
          ))}
          {sorted.length === 0 && (
            <div className="px-4 py-8 text-center text-primary-400 text-xs font-mono">
              No departments found. Create departments first.
            </div>
          )}
        </div>
      </div>
{/* Stages & Task Categorization */}
      <div className="mt-6 border border-primary-200">
        <div className="px-4 py-3 border-b border-primary-200 bg-primary-50 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-dark-600">
              Stages & Task Categorization
            </h2>
            <p className="text-[10px] text-primary-500 font-mono mt-0.5">
              Master task list grouped by workflow stage. Project view shows Stage Progress by this categorization.
            </p>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {STAGE_SEQUENCE.map((stage, index) => {
            const tasks = STAGE_TASK_CATEGORIES.filter((c) => c.stage === stage);
            const departmentsPresent = [...new Set(tasks.map((c) => c.department))];
            return (
              <div key={stage} className="border border-primary-100 rounded-lg">
                <div className="flex items-center justify-between px-4 py-2.5 bg-primary-50/50 border-b border-primary-100">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-sm bg-dark-500 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-dark-600">
                      {STAGE_LABELS[stage] || formatStageName(stage)}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-primary-500">
                    {tasks.length} tasks · {departmentsPresent.length} departments
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-primary-100/60">
                  {tasks.map((task, i) => (
                    <div key={i} className="flex items-start gap-2 bg-white px-3 py-2">
                      <span className="text-[9px] font-mono text-dark-400 mt-0.5 shrink-0">
                        {DEPARTMENT_LABELS[task.department] || task.department}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-dark-500 leading-tight">{task.title}</p>
                        <p className="text-[10px] text-primary-400 font-mono mt-0.5 line-clamp-2">{task.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}