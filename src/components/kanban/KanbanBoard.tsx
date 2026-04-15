'use client';

import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { Lock, AlertTriangle, User, UserPlus } from 'lucide-react';
import { cn, DEPARTMENT_LABELS, formatDate, apiFetch } from '@/lib/utils';
import { TaskAssignPanel } from '@/components/task/TaskAssignPanel';
import type { ITask } from '@/types';
import { TaskStatus } from '@/types';

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: TaskStatus.TODO, label: 'To Do' },
  { id: TaskStatus.IN_PROGRESS, label: 'In Progress' },
  { id: TaskStatus.BLOCKED, label: 'Blocked' },
  { id: TaskStatus.DONE, label: 'Done' },
];

interface KanbanBoardProps {
  tasks: ITask[];
  onTaskUpdate?: (updatedTask: ITask) => void;
  canDrag?: (task: ITask) => boolean;
  canAssign?: boolean;
}

export function KanbanBoard({ tasks, onTaskUpdate, canDrag, canAssign = false }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<ITask | null>(null);
  const [optimisticTasks, setOptimisticTasks] = useState<ITask[]>(tasks);

  useEffect(() => {
    setOptimisticTasks(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.id] = optimisticTasks.filter((t) => t.status === col.id);
    return acc;
  }, {} as Record<TaskStatus, ITask[]>);

  const handleDragStart = (event: DragStartEvent) => {
    const task = optimisticTasks.find((t) => t._id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const task = optimisticTasks.find((t) => t._id === active.id);
    if (!task) return;

    const newStatus = over.id as TaskStatus;
    if (task.status === newStatus) return;
    if (task.isLocked || task.status === TaskStatus.BLOCKED) return;

    setOptimisticTasks((prev) =>
      prev.map((t) => (t._id === task._id ? { ...t, status: newStatus } : t))
    );

    const result = await apiFetch<ITask>(`/api/tasks/${task._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });

    if (!result.success) {
      setOptimisticTasks((prev) =>
        prev.map((t) => (t._id === task._id ? { ...t, status: task.status } : t))
      );
    } else if (result.data) {
      onTaskUpdate?.(result.data);
    }
  };

  const handleAssigned = (updated: ITask) => {
    setOptimisticTasks((prev) =>
      prev.map((t) => (t._id === updated._id ? updated : t))
    );
    onTaskUpdate?.(updated);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-4 gap-4 h-full">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            tasks={tasksByStatus[col.id] ?? []}
            canDrag={canDrag}
            canAssign={canAssign}
            onAssigned={handleAssigned}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  id, label, tasks, canDrag, canAssign, onAssigned,
}: {
  id: TaskStatus;
  label: string;
  tasks: ITask[];
  canDrag?: (task: ITask) => boolean;
  canAssign?: boolean;
  onAssigned?: (task: ITask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const columnStyles: Record<TaskStatus, string> = {
    [TaskStatus.TODO]: 'border-gray-200',
    [TaskStatus.IN_PROGRESS]: 'border-black',
    [TaskStatus.BLOCKED]: 'border-red-300',
    [TaskStatus.DONE]: 'border-gray-400',
  };

  const headerStyles: Record<TaskStatus, string> = {
    [TaskStatus.TODO]: 'bg-gray-50 text-gray-600',
    [TaskStatus.IN_PROGRESS]: 'bg-black text-white',
    [TaskStatus.BLOCKED]: 'bg-red-50 text-red-700',
    [TaskStatus.DONE]: 'bg-gray-800 text-white',
  };

  return (
    <div className={cn(
      'flex flex-col border rounded-none min-h-[600px] transition-colors',
      columnStyles[id],
      isOver && id !== TaskStatus.BLOCKED && 'bg-gray-50'
    )}>
      <div className={cn('px-3 py-2.5 flex items-center justify-between', headerStyles[id])}>
        <span className="text-xs font-mono font-bold uppercase tracking-widest">{label}</span>
        <span className={cn(
          'text-xs font-mono font-bold w-5 h-5 flex items-center justify-center rounded-full',
          id === TaskStatus.IN_PROGRESS || id === TaskStatus.DONE
            ? 'bg-white/20 text-white'
            : id === TaskStatus.BLOCKED
            ? 'bg-red-100 text-red-700'
            : 'bg-gray-200 text-gray-700'
        )}>
          {tasks.length}
        </span>
      </div>

      <div ref={setNodeRef} className="flex-1 p-2 space-y-2 overflow-y-auto">
        {tasks.map((task) => (
          <DraggableTaskCard
            key={task._id}
            task={task}
            isDraggable={
              !task.isLocked &&
              task.status !== TaskStatus.BLOCKED &&
              (canDrag?.(task) ?? true)
            }
            canAssign={canAssign}
            onAssigned={onAssigned}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-24 border border-dashed border-gray-200">
            <span className="text-xs text-gray-400 font-mono">Empty</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableTaskCard({
  task, isDraggable, canAssign, onAssigned,
}: {
  task: ITask;
  isDraggable: boolean;
  canAssign?: boolean;
  onAssigned?: (task: ITask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task._id,
    disabled: !isDraggable,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
      className={cn(isDragging && 'opacity-40')}
    >
      <TaskCard task={task} isDraggable={isDraggable} canAssign={canAssign} onAssigned={onAssigned} />
    </div>
  );
}

export function TaskCard({
  task, isDraggable, isDragging, onClick, canAssign, onAssigned,
}: {
  task: ITask;
  isDraggable?: boolean;
  isDragging?: boolean;
  onClick?: () => void;
  canAssign?: boolean;
  onAssigned?: (task: ITask) => void;
}) {
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const assignRef = useRef<HTMLDivElement>(null);
  const isBlocked = task.status === TaskStatus.BLOCKED;
  const isLocked = task.isLocked;

  const assignedUser =
    typeof task.assignedUser === 'object' && task.assignedUser !== null
      ? (task.assignedUser as { name: string })
      : null;

  // Close assign panel on outside click
  useEffect(() => {
    if (!showAssignPanel) return;
    const handler = (e: MouseEvent) => {
      if (assignRef.current && !assignRef.current.contains(e.target as Node)) {
        setShowAssignPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAssignPanel]);

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white border text-sm select-none transition-all relative group',
        isBlocked
          ? 'border-red-300 bg-red-50/30 ring-1 ring-red-200'
          : isLocked
          ? 'border-gray-200 opacity-60 bg-gray-50'
          : 'border-gray-200 hover:border-gray-400 hover:shadow-sm',
        isDraggable && !isBlocked && !isLocked && 'cursor-grab active:cursor-grabbing',
        isDragging && 'shadow-xl rotate-1',
        onClick && 'cursor-pointer'
      )}
    >
      {isBlocked && <div className="h-1 bg-red-500 w-full" />}

      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          {isLocked && !isBlocked && (
            <Lock className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" />
          )}
          {isBlocked && (
            <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5 animate-pulse" />
          )}
          <p className={cn(
            'text-xs font-semibold leading-tight flex-1',
            isBlocked ? 'text-red-700' : isLocked ? 'text-gray-400' : 'text-gray-900'
          )}>
            {task.title}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wide">
            {DEPARTMENT_LABELS[task.department]}
          </span>
          {task.dueDate && (
            <span className={cn(
              'text-[10px] font-mono',
              new Date(task.dueDate) < new Date() ? 'text-red-500 font-bold' : 'text-gray-400'
            )}>
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>

        {/* Assignee row */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          {assignedUser ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <User className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
              <span className="text-[10px] text-gray-500 truncate">{assignedUser.name}</span>
            </div>
          ) : (
            <span className="text-[10px] text-gray-300 italic flex-1">Unassigned</span>
          )}

          {canAssign && !isLocked && !isBlocked && (
            <button
              onMouseDown={(e) => { e.stopPropagation(); setShowAssignPanel((v) => !v); }}
              className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 text-gray-400 hover:text-black transition-all"
              title="Assign user"
            >
              <UserPlus className="w-3 h-3" />
            </button>
          )}
        </div>

        {isLocked && !isBlocked && (
          <p className="text-[10px] text-gray-400 italic">Waiting for dependency</p>
        )}
      </div>

      {/* Assign panel popover */}
      {showAssignPanel && (
        <div
          ref={assignRef}
          className="absolute right-0 top-full mt-1 z-50"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <TaskAssignPanel
            task={task}
            onAssigned={(updated) => {
              setShowAssignPanel(false);
              onAssigned?.(updated);
            }}
            onClose={() => setShowAssignPanel(false)}
          />
        </div>
      )}
    </div>
  );
}
