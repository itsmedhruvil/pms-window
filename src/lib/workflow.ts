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
  STAGE_TASK_CATEGORIES,
  Stage,
  resolveTaskStage,
} from '@/types';
import type { Department } from '@/types';
import { getActiveDepartmentNames } from '@/lib/departments';
import { ClientSession } from 'mongoose';

/**
 * Tasks used to support a fourth `blocked` status driven by alerts. It is no
 * longer part of `TaskStatus`, but old documents may still carry the value, so
 * it is kept here as a raw string for the legacy cleanup in
 * `normalizeLegacyTaskStatuses`.
 */
const LEGACY_BLOCKED_STATUS = 'blocked';

async function getWorkflowDepartments() {
  const departments = await getActiveDepartmentNames();
  return departments.length > 0 ? departments : DEPARTMENT_SEQUENCE;
}

export async function backfillProjectTaskStages() {
  const tasks = await TaskModel.find({
    $or: [
      { stage: { $exists: false } },
      { stage: null },
      { stage: '' },
    ],
  }).lean();

  for (const task of tasks) {
    const resolvedStage = resolveTaskStage({ stage: task.stage, title: task.title });
    if (!resolvedStage) continue;

    await TaskModel.updateOne(
      { _id: task._id },
      { $set: { stage: resolvedStage } }
    );
  }

  const templates = await TaskTemplateModel.find({
    $or: [
      { stage: { $exists: false } },
      { stage: null },
      { stage: '' },
    ],
  }).lean();

  for (const template of templates) {
    const resolvedStage = STAGE_TASK_CATEGORIES.find(
      (category) =>
        category.department === template.department &&
        template.title.toLowerCase().includes(category.title.toLowerCase())
    )?.stage;

    if (!resolvedStage) continue;

    await TaskTemplateModel.updateOne(
      { _id: template._id },
      { $set: { stage: resolvedStage } }
    );
  }
}

export async function ensureDefaultTaskTemplates() {
  const departmentSequence = new Map<string, number>();
  const canonicalTemplates = STAGE_TASK_CATEGORIES.map((task) => {
    const nextSequence = departmentSequence.get(task.department) ?? 0;
    departmentSequence.set(task.department, nextSequence + 1);

    return {
      department: task.department,
      stage: task.stage,
      title: task.title,
      description: task.description,
      sequence: nextSequence,
      frequency: task.frequency,
      isActive: true,
      linkedToProduct: false,
    };
  });

  const existingTemplates = await TaskTemplateModel.find({}).lean();
  if (existingTemplates.length === 0) {
    await TaskTemplateModel.insertMany(canonicalTemplates);
    await backfillProjectTaskStages();
    return;
  }

  const updates: Promise<any>[] = [];
  for (const canonical of canonicalTemplates) {
    const match = existingTemplates.find(
      (template) =>
        String((template as any).department).toLowerCase() === String(canonical.department).toLowerCase() &&
        String((template as any).title).trim().toLowerCase() === String(canonical.title).trim().toLowerCase()
    );

    if (!match) {
      updates.push(TaskTemplateModel.create({ ...canonical }));
      continue;
    }

    const needsUpdate =
      String((match as any).stage || '').toLowerCase() !== String(canonical.stage || '').toLowerCase() ||
      String((match as any).description || '').trim() !== String(canonical.description || '').trim() ||
      Number((match as any).sequence ?? 0) !== Number(canonical.sequence) ||
      String((match as any).frequency || 'project') !== String(canonical.frequency || 'project');

    if (needsUpdate) {
      updates.push(
        TaskTemplateModel.findByIdAndUpdate(
          (match as any)._id,
          {
            $set: {
              stage: canonical.stage,
              description: canonical.description,
              sequence: canonical.sequence,
              frequency: canonical.frequency,
              isActive: true,
              linkedToProduct: false,
            },
          },
          { new: true }
        )
      );
    }
  }

  await Promise.all(updates);
  await backfillProjectTaskStages();
}

/**
 * Generate all workflow tasks for a new project
 * If windowSpecs contain templateGroupId references, generates per-window tasks from template groups.
 * Otherwise falls back to the old behavior of generating from TaskTemplates.
 */
export async function generateProjectTasks(
  projectId: Types.ObjectId,
  createdByUserId: Types.ObjectId,
  windowSpecifications?: Array<{ templateGroupId?: string; design: string; quantity: number }>,
  totalWindowsOverride?: number,
  session?: ClientSession
): Promise<void> {
  if (windowSpecifications && windowSpecifications.some((ws) => ws.templateGroupId)) {
    await generateFromTemplateGroups(projectId, createdByUserId, windowSpecifications, totalWindowsOverride, session);
    return;
  }

  await generateFromTaskTemplates(projectId, createdByUserId, totalWindowsOverride, session);
}

/**
 * Generate tasks from a selected template group (project-level, no window specs)
 * Now separates project tasks from internal tasks.
 * Project tasks get projectId; internal tasks are standalone (no projectId).
 */
export async function generateFromSelectedTemplateGroup(
  projectId: Types.ObjectId,
  createdByUserId: Types.ObjectId,
  templateGroupId: string,
  totalWindows?: number,
  session?: ClientSession
): Promise<void> {
  const TemplateGroupModel = (await import('@/models/TemplateGroup')).default;
  const group = await TemplateGroupModel.findById(templateGroupId).lean();
  if (!group || !group.tasks.length) {
    // Fall back to default task templates
    return generateFromTaskTemplates(projectId, createdByUserId, totalWindows, session);
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
  const resolvedTotalWindows = totalWindows ?? (await getProjectTotalWindows(projectId, session));

  for (const dept of departments) {
    const deptTasks = (projectDeptMap.get(dept) || []).sort((a, b) => a.sequence - b.sequence);
    if (deptTasks.length === 0) continue;

    for (const taskData of deptTasks) {
      const isLinked = (taskData as any).linkedToProduct === true;

      if (isLinked && resolvedTotalWindows > 1) {
        // Create one task per product
        for (let w = 0; w < resolvedTotalWindows; w++) {
          projectTasks.push({
            _id: new Types.ObjectId(),
            projectId,
            department: dept as Department,
            stage: (taskData as any).stage || undefined,
            title: `${taskData.title} for Product No-${w + 1}`,
            description: `${taskData.description} (Product No-${w + 1} of ${resolvedTotalWindows})`,
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
          stage: (taskData as any).stage || undefined,
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
        stage: (taskData as any).stage || undefined,
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
    await TaskModel.insertMany(projectTasks, { session });

    await CommentModel.create([{
      taskId: projectTasks[0]._id,
      content: `Project workflow initialized from template group "${group.name}". ${projectTasks.length} project tasks created across departments.`,
      author: createdByUserId,
      isSystemLog: true,
    }], { session });
  }

  // Insert internal tasks
  if (internalTasks.length > 0) {
    await TaskModel.insertMany(internalTasks, { session });

    const deptLabels = [...new Set(internalTasks.map((t: any) => t.department))].join(', ');
    await CommentModel.create([{
      content: `Internal tasks auto-generated from template group "${group.name}": ${internalTasks.length} tasks created for ${deptLabels}.`,
      author: createdByUserId,
      isSystemLog: true,
    }], { session });
  }
}

/**
 * Old behavior: generate tasks from active TaskTemplates
 */

/**
 * Get the total windows count for a project to use in task multiplication
 */
async function getProjectTotalWindows(projectId: Types.ObjectId, session?: ClientSession): Promise<number> {
  const query = ProjectModel.findById(projectId).select('totalWindows').lean();
  if (session) {
    query.session(session);
  }
  const project = await query;
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
  sequenceStart: number,
  session?: ClientSession
): Promise<{ tasks: any[]; nextSequence: number }> {
  const tasks: any[] = [];
  let seq = sequenceStart;

  // Operations: 1 Dispatch task per window
  for (let w = 0; w < totalWindows; w++) {
    tasks.push({
      _id: new Types.ObjectId(),
      projectId,
      department: 'operations' as Department,
      stage: Stage.PRODUCTION,
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
      stage: Stage.SITE,
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
      stage: Stage.SITE,
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
  createdByUserId: Types.ObjectId,
  totalWindowsOverride?: number,
  session?: ClientSession
): Promise<void> {
  await ensureDefaultTaskTemplates();

  const tasks = [];
  let globalSequence = 0;
  let previousDeptLastTaskId: Types.ObjectId | null = null;
  const departments = await getWorkflowDepartments();
  const resolvedTotalWindows = totalWindowsOverride ?? (await getProjectTotalWindows(projectId, session));

  for (const dept of departments) {
    const deptTasks = await TaskTemplateModel.find({ department: dept, isActive: true })
      .sort({ sequence: 1, createdAt: 1 })
      .lean();
    let previousTaskIdInDept: Types.ObjectId | null = null;

    for (let i = 0; i < deptTasks.length; i++) {
      const taskData = deptTasks[i];
      const isLinked = (taskData as any).linkedToProduct === true;

      if (isLinked && resolvedTotalWindows > 1) {
        // Create one task per product
        for (let w = 0; w < resolvedTotalWindows; w++) {
          const taskId = new Types.ObjectId();
          tasks.push({
            _id: taskId,
            projectId,
            templateTaskId: taskData._id,
            department: dept,
            stage: (taskData as any).stage || undefined,
            title: `${taskData.title} for Product No-${w + 1}`,
            description: `${taskData.description} (Product No-${w + 1} of ${resolvedTotalWindows})`,
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
          stage: (taskData as any).stage || undefined,
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
    resolvedTotalWindows,
    globalSequence,
    session
  );
  tasks.push(...windowTasks);
  globalSequence = nextSequence;

  await TaskModel.insertMany(tasks, { session });

  await CommentModel.create([{
    taskId: tasks[0]._id,
    content: `Project workflow initialized. ${tasks.length} tasks created across ${departments.length} departments (including ${resolvedTotalWindows} window-based dispatch/installation/QC tasks).`,
    author: createdByUserId,
    isSystemLog: true,
  }], { session });
}

/**
 * New behavior: generate tasks from selected TemplateGroups per window specification.
 * Task generation now creates one workflow chain per selected template group spec;
 * quantity is no longer used to multiply tasks.
 */
async function generateFromTemplateGroups(
  projectId: Types.ObjectId,
  createdByUserId: Types.ObjectId,
  windowSpecifications: Array<{ templateGroupId?: string; design: string; quantity: number }>,
  totalWindowsOverride?: number,
  session?: ClientSession
): Promise<void> {
  const TemplateGroupModel = (await import('@/models/TemplateGroup')).default;
  const tasks = [];
  let globalSequence = 0;
  let previousDeptLastTaskId: Types.ObjectId | null = null;
  const departments = await getWorkflowDepartments();

  // Get total windows for linked-to-product multiplication
  const resolvedTotalWindows = totalWindowsOverride ?? (await getProjectTotalWindows(projectId, session));

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

    for (const dept of departments) {
      const deptTasks = (deptMap.get(dept) || []).sort((a, b) => a.sequence - b.sequence);
      if (deptTasks.length === 0) continue;

      let previousTaskIdInDept: Types.ObjectId | null = null;

      for (let i = 0; i < deptTasks.length; i++) {
        const taskData = deptTasks[i];
        const isLinked = (taskData as any).linkedToProduct === true;

        if (isLinked && resolvedTotalWindows > 1) {
          // Create one task per product
          for (let w = 0; w < resolvedTotalWindows; w++) {
            const taskId = new Types.ObjectId();
            tasks.push({
              _id: taskId,
              projectId,
              department: dept as any,
              stage: (taskData as any).stage || undefined,
              title: `${taskData.title} — ${spec.design} for Product No-${w + 1}`,
              description: `${taskData.description} (Product No-${w + 1} of ${resolvedTotalWindows} — ${spec.design})`,
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
            stage: (taskData as any).stage || undefined,
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
    return generateFromTaskTemplates(projectId, createdByUserId, resolvedTotalWindows, session);
  }

  // Add window-multiplied tasks for Operations (dispatch) and Site (installation, QC)
  const { tasks: windowTasks, nextSequence } = await generateWindowMultipliedTasks(
    projectId,
    resolvedTotalWindows,
    globalSequence,
    session
  );
  tasks.push(...windowTasks);
  globalSequence = nextSequence;

  await TaskModel.insertMany(tasks, { session });

  await CommentModel.create([{
    taskId: tasks[0]._id,
    content: `Project workflow initialized from template groups. ${tasks.length} tasks created for ${windowSpecifications.filter((ws) => ws.templateGroupId).length} window types (including ${resolvedTotalWindows} window-based dispatch/installation/QC tasks).`,
    author: createdByUserId,
    isSystemLog: true,
  }], { session });
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
    .select('_id')
    .lean();

  if (dependentTasks.length === 0) return;

  // Bulk update all dependent tasks in one operation
  const bulkOps = dependentTasks.map((task) => ({
    updateOne: {
      filter: { _id: task._id },
      update: { $set: { isLocked: false } },
    },
  }));

  await TaskModel.bulkWrite(bulkOps);

  // Realtime events removed
}

/**
 * Legacy data hygiene.
 *
 * Tasks used to support a fourth `blocked` status that alerts would set.
 * Task statuses are now limited to Pending / Ongoing / Done, so any leftover
 * `blocked` document is normalised back to Pending here. Also keeps
 * `Project.activeAlertIds` in sync with the project's unresolved alerts.
 */
export async function normalizeLegacyTaskStatuses(projectId?: string): Promise<void> {
  const scope = projectId ? { projectId: new Types.ObjectId(projectId) } : {};

  // `blocked` is no longer a valid TaskStatus, so the raw collection is used
  // for this legacy cleanup instead of the typed model API.
  const legacyTasks = await TaskModel.collection
    .find({ ...scope, status: LEGACY_BLOCKED_STATUS }, { projection: { projectId: 1 } })
    .toArray();

  if (legacyTasks.length === 0 && !projectId) return;

  if (legacyTasks.length > 0) {
    await TaskModel.collection.updateMany(
      { ...scope, status: LEGACY_BLOCKED_STATUS },
      { $set: { status: TaskStatus.TODO } }
    );
  }

  const projectIds: string[] = projectId
    ? [projectId]
    : [
        ...new Set(
          legacyTasks
            .map((task) => (task.projectId ? String(task.projectId) : null))
            .filter((id): id is string => Boolean(id))
        ),
      ];

  await Promise.all(
    projectIds.map(async (id) => {
      const openAlerts = await AlertModel.find({
        projectId: id,
        status: { $ne: AlertStatus.RESOLVED },
      })
        .select('_id')
        .lean();

      await ProjectModel.findByIdAndUpdate(id, {
        $set: { activeAlertIds: openAlerts.map((alert) => alert._id) },
      });
    })
  );
}

/**
 * Normalise a single task that may still carry the legacy `blocked` status.
 * Uses the `_id` index and matches nothing once the data is clean, so it is
 * cheap enough to run on every task detail load.
 */
export async function normalizeLegacyTaskStatus(taskId: string): Promise<void> {
  if (!Types.ObjectId.isValid(taskId)) return;

  await TaskModel.collection.updateOne(
    { _id: new Types.ObjectId(taskId), status: LEGACY_BLOCKED_STATUS },
    { $set: { status: TaskStatus.TODO } }
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
 * Apply alert effects: put the project on hold and register the alert.
 *
 * Alerts no longer change task status — tasks only ever have the three
 * statuses Pending / Ongoing / Done. The alert itself remains visible on the
 * project and task so teams can see what is affected.
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
}

/**
 * Resolve alert effects: restore project status and clear the active alert.
 */
export async function resolveAlertEffects(alertId: string): Promise<void> {
  const alert = await AlertModel.findById(alertId);
  if (!alert) return;

  // Internal task alerts (no projectId) have no project state to restore.
  if (!alert.projectId) return;

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

  const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
    [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.DONE],
    [TaskStatus.IN_PROGRESS]: [TaskStatus.DONE, TaskStatus.TODO],
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