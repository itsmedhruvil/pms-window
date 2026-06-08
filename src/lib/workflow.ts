import { Types } from 'mongoose';
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
import type { Department } from '@/types';
import { getActiveDepartmentNames } from '@/lib/departments';

async function getWorkflowDepartments() {
  const departments = await getActiveDepartmentNames();
  return departments.length > 0 ? departments : DEPARTMENT_SEQUENCE;
}

export async function ensureDefaultTaskTemplates() {
  const existingCount = await TaskTemplateModel.estimatedDocumentCount();
  if (existingCount > 0) return;

  const departments = await getWorkflowDepartments();
  const templates = departments.flatMap((department) =>
    (DEFAULT_TASKS_PER_DEPARTMENT[department] || []).map((task, index) => ({
      department,
      title: task.title,
      description: task.description,
      sequence: index,
      frequency: 'project',
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
 * Generate tasks from a selected template group (project-level, no window specs)
 * Now separates project tasks from internal tasks.
 * Project tasks get projectId; internal tasks are standalone (no projectId).
 */
export async function generateFromSelectedTemplateGroup(
  projectId: Types.ObjectId,
  createdByUserId: Types.ObjectId,
  templateGroupId: string
): Promise<void> {
  const TemplateGroupModel = (await import('@/models/TemplateGroup')).default;
  const group = await TemplateGroupModel.findById(templateGroupId).lean();
  if (!group || !group.tasks.length) {
    // Fall back to default task templates
    return generateFromTaskTemplates(projectId, createdByUserId);
  }

  // Separate project tasks from internal tasks
  const projectTasks: any[] = [];
  const internalTasks: any[] = [];
  let globalSequence = 0;

  // Group tasks by type then by department
  const projectDeptMap = new Map<string, typeof group.tasks>();
  const internalDeptMap = new Map<string, typeof group.tasks>();

  for (const task of group.tasks) {
    if ((task as any).type === 'internal') {
      if (!internalDeptMap.has(task.department)) {
        internalDeptMap.set(task.department, []);
      }
      internalDeptMap.get(task.department)!.push(task);
    } else {
      if (!projectDeptMap.has(task.department)) {
        projectDeptMap.set(task.department, []);
      }
      projectDeptMap.get(task.department)!.push(task);
    }
  }

  // Create project tasks (linked to this project)
  const departments = await getWorkflowDepartments();
  const totalWindows = await getProjectTotalWindows(projectId);

  for (const dept of departments) {
    const deptTasks = (projectDeptMap.get(dept) || []).sort((a, b) => a.sequence - b.sequence);
    if (deptTasks.length === 0) continue;

    for (const taskData of deptTasks) {
      const isLinked = (taskData as any).linkedToProduct === true;

      if (isLinked && totalWindows > 1) {
        // Create one task per product
        for (let w = 0; w < totalWindows; w++) {
          projectTasks.push({
            _id: new Types.ObjectId(),
            projectId,
            department: dept as Department,
            title: `${taskData.title} for Product No-${w + 1}`,
            description: `${taskData.description} (Product No-${w + 1} of ${totalWindows})`,
            status: TaskStatus.TODO,
            frequency: (taskData as any).frequency || 'project',
            dependencyTaskId: null,
            isLocked: false,
            sequence: globalSequence++,
          });
        }
      } else {
        projectTasks.push({
          _id: new Types.ObjectId(),
          projectId,
          department: dept as Department,
          title: taskData.title,
          description: taskData.description,
          status: TaskStatus.TODO,
          frequency: (taskData as any).frequency || 'project',
          dependencyTaskId: null,
          isLocked: false,
          sequence: globalSequence++,
        });
      }
    }
  }

  // Create internal tasks (standalone, no projectId)
  for (const dept of departments) {
    const deptTasks = (internalDeptMap.get(dept) || []).sort((a, b) => a.sequence - b.sequence);
    if (deptTasks.length === 0) continue;

    for (const taskData of deptTasks) {
      internalTasks.push({
        _id: new Types.ObjectId(),
        // No projectId — internal task
        department: dept as Department,
        title: taskData.title,
        description: taskData.description,
        status: TaskStatus.TODO,
        frequency: (taskData as any).frequency || 'project',
        dependencyTaskId: null,
        isLocked: false,
        sequence: globalSequence++,
      });
    }
  }

  // Insert project tasks
  if (projectTasks.length > 0) {
    await TaskModel.insertMany(projectTasks);

    await CommentModel.create({
      taskId: projectTasks[0]._id,
      content: `Project workflow initialized from template group "${group.name}". ${projectTasks.length} project tasks created across departments.`,
      author: createdByUserId,
      isSystemLog: true,
    });
  }

  // Insert internal tasks
  if (internalTasks.length > 0) {
    await TaskModel.insertMany(internalTasks);

    const deptLabels = [...new Set(internalTasks.map((t: any) => t.department))].join(', ');
    await CommentModel.create({
      content: `Internal tasks auto-generated from template group "${group.name}": ${internalTasks.length} tasks created for ${deptLabels}.`,
      author: createdByUserId,
      isSystemLog: true,
    });
  }
}

/**
 * Old behavior: generate tasks from active TaskTemplates
 */
/**
 * Get the total windows count for a project to use in task multiplication
 */
async function getProjectTotalWindows(projectId: Types.ObjectId): Promise<number> {
  const project = await ProjectModel.findById(projectId).select('totalWindows').lean();
  return project?.totalWindows || 1;
}

/**
 * Generate window-multiplied tasks for Operations (dispatch) and Site (installation, QC).
 * Creates one dispatch task per window for Operations,
 * and one installation + one QC task per window for Site.
 */
async function generateWindowMultipliedTasks(
  projectId: Types.ObjectId,
  totalWindows: number,
  sequenceStart: number
): Promise<{ tasks: any[]; nextSequence: number }> {
  const tasks: any[] = [];
  let seq = sequenceStart;

  // Operations: 1 Dispatch task per window
  for (let w = 0; w < totalWindows; w++) {
    tasks.push({
      _id: new Types.ObjectId(),
      projectId,
      department: 'operations' as Department,
      title: `Dispatch Window ${w + 1}`,
      description: `Dispatch window #${w + 1} of ${totalWindows} to client site.`,
      status: TaskStatus.TODO,
      frequency: 'project' as const,
      dependencyTaskId: null,
      isLocked: false,
      sequence: seq++,
    });
  }

  // Site: 2 tasks per window (Installation + QC)
  for (let w = 0; w < totalWindows; w++) {
    // Installation
    tasks.push({
      _id: new Types.ObjectId(),
      projectId,
      department: 'site' as Department,
      title: `Install Window ${w + 1}`,
      description: `Install window #${w + 1} of ${totalWindows} at client site.`,
      status: TaskStatus.TODO,
      frequency: 'project' as const,
      dependencyTaskId: null,
      isLocked: false,
      sequence: seq++,
    });

    // QC
    tasks.push({
      _id: new Types.ObjectId(),
      projectId,
      department: 'site' as Department,
      title: `QC Window ${w + 1}`,
      description: `Quality check for installed window #${w + 1} of ${totalWindows}.`,
      status: TaskStatus.TODO,
      frequency: 'project' as const,
      dependencyTaskId: null,
      isLocked: false,
      sequence: seq++,
    });
  }

  return { tasks, nextSequence: seq };
}

async function generateFromTaskTemplates(
  projectId: Types.ObjectId,
  createdByUserId: Types.ObjectId
): Promise<void> {
  await ensureDefaultTaskTemplates();

  const tasks = [];
  let globalSequence = 0;
  let previousDeptLastTaskId: Types.ObjectId | null = null;
  const departments = await getWorkflowDepartments();
  const totalWindows = await getProjectTotalWindows(projectId);

  for (const dept of departments) {
    const deptTasks = await TaskTemplateModel.find({ department: dept, isActive: true })
      .sort({ sequence: 1, createdAt: 1 })
      .lean();
    let previousTaskIdInDept: Types.ObjectId | null = null;

    for (let i = 0; i < deptTasks.length; i++) {
      const taskData = deptTasks[i];
      const isLinked = (taskData as any).linkedToProduct === true;

      if (isLinked && totalWindows > 1) {
        // Create one task per product
        for (let w = 0; w < totalWindows; w++) {
          const taskId = new Types.ObjectId();
          tasks.push({
            _id: taskId,
            projectId,
            templateTaskId: taskData._id,
            department: dept,
            title: `${taskData.title} for Product No-${w + 1}`,
            description: `${taskData.description} (Product No-${w + 1} of ${totalWindows})`,
            status: TaskStatus.TODO,
            frequency: (taskData as any).frequency || 'project',
            dependencyTaskId: null,
            isLocked: false,
            sequence: globalSequence++,
          });
          previousTaskIdInDept = taskId;
        }
      } else {
        const taskId = new Types.ObjectId();
        tasks.push({
          _id: taskId,
          projectId,
          templateTaskId: taskData._id,
          department: dept,
          title: taskData.title,
          description: taskData.description,
          status: TaskStatus.TODO,
          frequency: (taskData as any).frequency || 'project',
          dependencyTaskId: null,
          isLocked: false,
          sequence: globalSequence++,
        });
        previousTaskIdInDept = taskId;
      }
    }

    previousDeptLastTaskId = previousTaskIdInDept;
  }

  // Add window-multiplied tasks for Operations (dispatch) and Site (installation, QC)
  const { tasks: windowTasks, nextSequence } = await generateWindowMultipliedTasks(
    projectId,
    totalWindows,
    globalSequence
  );
  tasks.push(...windowTasks);
  globalSequence = nextSequence;

  await TaskModel.insertMany(tasks);

  await CommentModel.create({
    taskId: tasks[0]._id,
    content: `Project workflow initialized. ${tasks.length} tasks created across ${departments.length} departments (including ${totalWindows} window-based dispatch/installation/QC tasks).`,
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
  const departments = await getWorkflowDepartments();

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

    // Get total windows for linked-to-product multiplication
    const totalWindows = await getProjectTotalWindows(projectId);

    for (const dept of departments) {
      const deptTasks = (deptMap.get(dept) || []).sort((a, b) => a.sequence - b.sequence);
      if (deptTasks.length === 0) continue;

      let previousTaskIdInDept: Types.ObjectId | null = null;

      for (let i = 0; i < deptTasks.length; i++) {
        const taskData = deptTasks[i];
        const isLinked = (taskData as any).linkedToProduct === true;

        if (isLinked && totalWindows > 1) {
          // Create one task per product
          for (let w = 0; w < totalWindows; w++) {
            const taskId = new Types.ObjectId();
            tasks.push({
              _id: taskId,
              projectId,
              department: dept as any,
              title: `${taskData.title} — ${spec.design} for Product No-${w + 1}`,
              description: `${taskData.description} (Product No-${w + 1} of ${totalWindows} — ${spec.design})`,
              status: TaskStatus.TODO,
              frequency: (taskData as any).frequency || 'project',
              dependencyTaskId: null,
              isLocked: false,
              sequence: globalSequence++,
            });
            previousTaskIdInDept = taskId;
          }
        } else {
          const taskId = new Types.ObjectId();
          tasks.push({
            _id: taskId,
            projectId,
            department: dept as any,
            title: `${taskData.title} — ${spec.design}`,
            description: taskData.description,
            status: TaskStatus.TODO,
            frequency: (taskData as any).frequency || 'project',
            dependencyTaskId: null,
            isLocked: false,
            sequence: globalSequence++,
          });
          previousTaskIdInDept = taskId;
        }
      }

      previousDeptLastTaskId = previousTaskIdInDept;
    }
  }

  // If no template groups matched, fall back to old behavior
  if (tasks.length === 0) {
    return generateFromTaskTemplates(projectId, createdByUserId);
  }

  // Add window-multiplied tasks for Operations (dispatch) and Site (installation, QC)
  const totalWindows = await getProjectTotalWindows(projectId);
  const { tasks: windowTasks, nextSequence } = await generateWindowMultipliedTasks(
    projectId,
    totalWindows,
    globalSequence
  );
  tasks.push(...windowTasks);
  globalSequence = nextSequence;

  await TaskModel.insertMany(tasks);

  await CommentModel.create({
    taskId: tasks[0]._id,
    content: `Project workflow initialized from template groups. ${tasks.length} tasks created for ${windowSpecifications.filter((ws) => ws.templateGroupId).length} window types (including ${totalWindows} window-based dispatch/installation/QC tasks).`,
    author: createdByUserId,
    isSystemLog: true,
  });
}

/**
 * Check and unlock tasks whose dependencies are now met
 * Uses bulkWrite to update all dependent tasks in one operation
 */
export async function unlockDependentTasks(completedTaskId: string): Promise<void> {
  const dependentTasks = await TaskModel.find({
    dependencyTaskId: completedTaskId,
    isLocked: true,
  })
    .select('_id projectId status')
    .lean();

  if (dependentTasks.length === 0) return;

  // Bulk update all dependent tasks in one operation
  const bulkOps = dependentTasks.map((task) => {
    const setFields: Record<string, any> = { isLocked: false };
    if (task.status === TaskStatus.BLOCKED) {
      setFields.status = TaskStatus.TODO;
    }
    return {
      updateOne: {
        filter: { _id: task._id },
        update: { $set: setFields },
      },
    };
  });

  await TaskModel.bulkWrite(bulkOps);

  // Realtime events removed
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
 * Uses aggregation pipeline to calculate completion without loading all tasks
 */
export async function updateProjectCompletion(projectId: string): Promise<void> {
  // Use aggregation to get counts in a single query
  const pipeline = [
    { $match: { projectId: new Types.ObjectId(projectId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        doneCount: {
          $sum: { $cond: [{ $eq: ['$status', TaskStatus.DONE] }, 1, 0] },
        },
      },
    },
  ];

  // Use lean() with model.aggregate()
  const results = await TaskModel.aggregate(pipeline).allowDiskUse(true);
  
  if (!results || results.length === 0) return;
  
  const { total, doneCount } = results[0];
  if (total === 0) return;

  const completionPercentage = Math.round((doneCount / total) * 100);

  const updateFields: Record<string, any> = { completionPercentage };
  
  // Auto-complete project if all tasks done
  let shouldUpdateStatus = false;
  if (completionPercentage === 100) {
    updateFields.status = ProjectStatus.COMPLETED;
    shouldUpdateStatus = true;
  }

  // Use updateOne instead of find+save (single round trip)
  await ProjectModel.updateOne(
    { _id: new Types.ObjectId(projectId) },
    { $set: updateFields }
  );

  // Realtime events removed
}

/**
 * Apply alert effects: put project on hold, block affected tasks.
 * (DISCUSSION type was removed from alerts — discussions are now a standalone model.)
 */
export async function applyAlertEffects(alertId: string): Promise<void> {
  const alert = await AlertModel.findById(alertId).populate('projectId');
  if (!alert) return;

  // For project-level alerts: put project on hold
  if (alert.projectId) {
    await ProjectModel.findByIdAndUpdate(alert.projectId, {
      status: ProjectStatus.ON_HOLD,
      $addToSet: { activeAlertIds: alert._id },
    });
  }

  // Block the specific task if this alert is tied to one
  if (alert.taskId) {
    await TaskModel.findByIdAndUpdate(alert.taskId, {
      status: TaskStatus.BLOCKED,
    });
  } else if (alert.projectId) {
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
  // For internal task alerts with no projectId, only the task itself gets blocked (handled above)
}

/**
 * Resolve alert effects: restore project, unblock tasks
 */
export async function resolveAlertEffects(alertId: string): Promise<void> {
  const alert = await AlertModel.findById(alertId);
  if (!alert) return;

  // For internal task alerts (no projectId), just unblock the task and return
  if (!alert.projectId) {
    if (alert.taskId) {
      await TaskModel.findByIdAndUpdate(alert.taskId, {
        status: TaskStatus.TODO,
      });
    }
    return;
  }

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

  // Realtime events removed
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