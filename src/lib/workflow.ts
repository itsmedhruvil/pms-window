import { Types } from 'mongoose';
import { triggerEvent, CHANNELS, EVENTS } from '@/lib/pusher';
import TaskModel from '@/models/Task';
import TaskTemplateModel from '@/models/TaskTemplate';
import ProjectModel from '@/models/Project';
import AlertModel from '@/models/Alert';
import CommentModel from '@/models/Comment';
import {
  TaskStatus,
  ProjectStatus,
  AlertStatus,
  DEPARTMENT_SEQUENCE,
  DEFAULT_TASKS_PER_DEPARTMENT,
} from '@/types';

export async function ensureDefaultTaskTemplates() {
  const existingCount = await TaskTemplateModel.estimatedDocumentCount();
  if (existingCount > 0) return;

  const templates = DEPARTMENT_SEQUENCE.flatMap((department) =>
    DEFAULT_TASKS_PER_DEPARTMENT[department].map((task, index) => ({
      department,
      title: task.title,
      description: task.description,
      sequence: index,
      isActive: true,
    }))
  );

  await TaskTemplateModel.insertMany(templates);
}

/**
 * Generate all workflow tasks for a new project
 * If windowSpecs contain templateGroupId references, generates per-window tasks from template groups.
 * Otherwise falls back to the old behavior of generating from TaskTemplates.
 */
export async function generateProjectTasks(
  projectId: Types.ObjectId,
  createdByUserId: Types.ObjectId,
  windowSpecifications?: Array<{ templateGroupId?: string; design: string; quantity: number }>
): Promise<void> {
  if (windowSpecifications && windowSpecifications.some((ws) => ws.templateGroupId)) {
    await generateFromTemplateGroups(projectId, createdByUserId, windowSpecifications);
    return;
  }

  await generateFromTaskTemplates(projectId, createdByUserId);
}

/**
 * Old behavior: generate tasks from active TaskTemplates
 */
async function generateFromTaskTemplates(
  projectId: Types.ObjectId,
  createdByUserId: Types.ObjectId
): Promise<void> {
  await ensureDefaultTaskTemplates();

  const tasks = [];
  let globalSequence = 0;
  let previousDeptLastTaskId: Types.ObjectId | null = null;

  for (const dept of DEPARTMENT_SEQUENCE) {
    const deptTasks = await TaskTemplateModel.find({ department: dept, isActive: true })
      .sort({ sequence: 1, createdAt: 1 })
      .lean();
    let previousTaskIdInDept: Types.ObjectId | null = null;

    for (let i = 0; i < deptTasks.length; i++) {
      const taskData = deptTasks[i];
      const taskId = new Types.ObjectId();

      tasks.push({
        _id: taskId,
        projectId,
        templateTaskId: taskData._id,
        department: dept,
        title: taskData.title,
        description: taskData.description,
        status: TaskStatus.TODO,
        dependencyTaskId: null,
        isLocked: false,
        sequence: globalSequence++,
      });

      previousTaskIdInDept = taskId;
    }

    previousDeptLastTaskId = previousTaskIdInDept;
  }

  await TaskModel.insertMany(tasks);

  await CommentModel.create({
    taskId: tasks[0]._id,
    content: `Project workflow initialized. ${tasks.length} tasks created across ${DEPARTMENT_SEQUENCE.length} departments.`,
    author: createdByUserId,
    isSystemLog: true,
  });
}

/**
 * New behavior: generate tasks from selected TemplateGroups per window specification.
 * Task generation now creates one workflow chain per selected template group spec;
 * quantity is no longer used to multiply tasks.
 */
async function generateFromTemplateGroups(
  projectId: Types.ObjectId,
  createdByUserId: Types.ObjectId,
  windowSpecifications: Array<{ templateGroupId?: string; design: string; quantity: number }>
): Promise<void> {
  const TemplateGroupModel = (await import('@/models/TemplateGroup')).default;
  const tasks = [];
  let globalSequence = 0;
  let previousDeptLastTaskId: Types.ObjectId | null = null;

  // Process each window spec
  for (const spec of windowSpecifications) {
    if (!spec.templateGroupId) continue;

    const group = await TemplateGroupModel.findById(spec.templateGroupId).lean();
    if (!group) continue;

    // Generate one full department chain for this window spec
    const deptMap = new Map<string, typeof group.tasks>();
    for (const task of group.tasks) {
      if (!deptMap.has(task.department)) {
        deptMap.set(task.department, []);
      }
      deptMap.get(task.department)!.push(task);
    }

    for (const dept of DEPARTMENT_SEQUENCE) {
      const deptTasks = (deptMap.get(dept) || []).sort((a, b) => a.sequence - b.sequence);
      if (deptTasks.length === 0) continue;

      let previousTaskIdInDept: Types.ObjectId | null = null;

      for (let i = 0; i < deptTasks.length; i++) {
        const taskData = deptTasks[i];
        const taskId = new Types.ObjectId();

        tasks.push({
          _id: taskId,
          projectId,
          department: dept as any,
          title: `${taskData.title} — ${spec.design}`,
          description: taskData.description,
          status: TaskStatus.TODO,
          dependencyTaskId: null,
          isLocked: false,
          sequence: globalSequence++,
        });

        previousTaskIdInDept = taskId;
      }

      previousDeptLastTaskId = previousTaskIdInDept;
    }
  }

  // If no template groups matched, fall back to old behavior
  if (tasks.length === 0) {
    return generateFromTaskTemplates(projectId, createdByUserId);
  }

  await TaskModel.insertMany(tasks);

  await CommentModel.create({
    taskId: tasks[0]._id,
    content: `Project workflow initialized from template groups. ${tasks.length} tasks created for ${windowSpecifications.filter((ws) => ws.templateGroupId).length} window types.`,
    author: createdByUserId,
    isSystemLog: true,
  });
}

/**
 * Check and unlock tasks whose dependencies are now met
 */
export async function unlockDependentTasks(completedTaskId: string): Promise<void> {
  const dependentTasks = await TaskModel.find({
    dependencyTaskId: completedTaskId,
    isLocked: true,
  });

  for (const task of dependentTasks) {
    task.isLocked = false;
    if (task.status === TaskStatus.BLOCKED) {
      task.status = TaskStatus.TODO;
    }
    await task.save();

    await triggerEvent(CHANNELS.project(task.projectId.toString()), EVENTS.TASK_UPDATED, {
      taskId: task._id,
      status: task.status,
      isLocked: false,
    });
  }
}

/**
 * Repair stale blocked tasks by comparing them with unresolved alerts.
 * This keeps older data sane if an alert was resolved before unblock logic ran.
 */
export async function reconcileBlockedTasksWithAlerts(projectId?: string): Promise<void> {
  const projectIds = projectId
    ? [new Types.ObjectId(projectId)]
    : await TaskModel.distinct('projectId', { status: TaskStatus.BLOCKED });

  await Promise.all(
    projectIds.map(async (id) => {
      const openAlerts = await AlertModel.find({
        projectId: id,
        status: { $ne: AlertStatus.RESOLVED },
      })
        .select('_id taskId affectedDepartments')
        .lean();

      if (openAlerts.length === 0) {
        await Promise.all([
          TaskModel.updateMany(
            { projectId: id, status: TaskStatus.BLOCKED },
            { $set: { status: TaskStatus.TODO } }
          ),
          ProjectModel.findByIdAndUpdate(id, { $set: { activeAlertIds: [] } }),
        ]);
        return;
      }

      const taskAlertTaskIds = openAlerts
        .map((alert) => alert.taskId)
        .filter((taskId): taskId is NonNullable<typeof taskId> => Boolean(taskId))
        .map((id) => id.toString());
      const globalAlertDepartments = [
        ...new Set(
          openAlerts
            .filter((alert) => !alert.taskId)
            .flatMap((alert) => alert.affectedDepartments)
        ),
      ];

      await Promise.all([
        TaskModel.updateMany(
          {
            projectId: id,
            status: TaskStatus.BLOCKED,
            _id: { $nin: taskAlertTaskIds },
            department: { $nin: globalAlertDepartments },
          },
          { $set: { status: TaskStatus.TODO } }
        ),
        ProjectModel.findByIdAndUpdate(id, {
          $set: { activeAlertIds: openAlerts.map((alert) => alert._id) },
        }),
      ]);
    })
  );
}

/**
 * Update project completion percentage based on task status
 */
export async function updateProjectCompletion(projectId: string): Promise<void> {
  const tasks = await TaskModel.find({ projectId });
  if (tasks.length === 0) return;

  const doneTasks = tasks.filter((t) => t.status === TaskStatus.DONE).length;
  const completionPercentage = Math.round((doneTasks / tasks.length) * 100);

  const project = await ProjectModel.findById(projectId);
  if (!project) return;

  project.completionPercentage = completionPercentage;

  // Auto-complete project if all tasks done
  if (completionPercentage === 100 && project.status === ProjectStatus.IN_PRODUCTION) {
    project.status = ProjectStatus.COMPLETED;
  }

  await project.save();

  await triggerEvent(CHANNELS.project(projectId), EVENTS.PROJECT_STATUS_CHANGED, {
    projectId,
    status: project.status,
    completionPercentage,
  });
}

/**
 * Apply alert effects: put project on hold, block affected tasks
 */
export async function applyAlertEffects(alertId: string): Promise<void> {
  const alert = await AlertModel.findById(alertId).populate('projectId');
  if (!alert) return;

  // Put project on hold
  await ProjectModel.findByIdAndUpdate(alert.projectId, {
    status: ProjectStatus.ON_HOLD,
    $addToSet: { activeAlertIds: alert._id },
  });

  if (alert.taskId) {
    await TaskModel.findByIdAndUpdate(alert.taskId, {
      status: TaskStatus.BLOCKED,
    });
  } else {
    // Global/project alert: block tasks in affected departments
    await TaskModel.updateMany(
      {
        projectId: alert.projectId,
        department: { $in: alert.affectedDepartments },
        status: { $in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
      },
      { $set: { status: TaskStatus.BLOCKED } }
    );
  }

  // Global notification
  await triggerEvent(CHANNELS.global, EVENTS.ALERT_CREATED, {
    alertId: alert._id,
    projectId: alert.projectId,
    severity: alert.severity,
    type: alert.type,
  });
}

/**
 * Resolve alert effects: restore project, unblock tasks
 */
export async function resolveAlertEffects(alertId: string): Promise<void> {
  const alert = await AlertModel.findById(alertId);
  if (!alert) return;

  // Remove from project's active alerts
  await ProjectModel.findByIdAndUpdate(alert.projectId, {
    $pull: { activeAlertIds: alert._id },
  });

  // Check if any other unresolved alerts exist
  const remainingAlerts = await AlertModel.countDocuments({
    projectId: alert.projectId,
    status: { $ne: AlertStatus.RESOLVED },
  });

  if (remainingAlerts === 0) {
    // Restore project status
    await ProjectModel.findByIdAndUpdate(alert.projectId, {
      status: ProjectStatus.IN_PRODUCTION,
    });
  }

  await reconcileBlockedTasksWithAlerts(alert.projectId.toString());

  await triggerEvent(CHANNELS.project(alert.projectId.toString()), EVENTS.ALERT_UPDATED, {
    alertId: alert._id,
    status: AlertStatus.RESOLVED,
  });
}

/**
 * Validate task status transition
 */
export function validateTaskTransition(
  currentStatus: TaskStatus,
  newStatus: TaskStatus,
  isLocked: boolean
): { valid: boolean; reason?: string } {
  if (isLocked) {
    return { valid: false, reason: 'Task is locked. Complete dependent tasks first.' };
  }

  if (currentStatus === TaskStatus.BLOCKED) {
    return { valid: false, reason: 'Task is blocked by an active alert.' };
  }

  const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
    [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.DONE],
    [TaskStatus.IN_PROGRESS]: [TaskStatus.DONE, TaskStatus.TODO],
    [TaskStatus.BLOCKED]: [], // Cannot transition from blocked
    [TaskStatus.DONE]: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
  };

  if (!allowedTransitions[currentStatus].includes(newStatus)) {
    return {
      valid: false,
      reason: `Cannot transition from ${currentStatus} to ${newStatus}`,
    };
  }

  return { valid: true };
}

/**
 * Create system log comment
 */
export async function createSystemLog(
  options: {
    taskId?: string;
    alertId?: string;
    content: string;
    authorId: string;
  }
): Promise<void> {
  await CommentModel.create({
    taskId: options.taskId,
    alertId: options.alertId,
    content: options.content,
    author: options.authorId,
    isSystemLog: true,
    mentions: [],
  });
}
