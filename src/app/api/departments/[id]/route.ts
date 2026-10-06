import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import DepartmentModel from '@/models/Department';
import UserModel from '@/models/User';
import TaskModel from '@/models/Task';
import CommentModel from '@/models/Comment';
import { withAuth } from '@/lib/auth';
import { updateProjectCompletion } from '@/lib/workflow';
import { UserRole, FactoryGroup } from '@/types';

// GET /api/departments/[id]
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  await connectDB();
  const { id } = await ctx.params;

  const department = await DepartmentModel.findById(id).select('-__v').lean();
  if (!department) {
    return NextResponse.json({ success: false, error: 'Department not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: department });
});

// PATCH /api/departments/[id]
export const PATCH = withAuth(
  async (req: NextRequest, ctx) => {
    await connectDB();
    const { id } = await ctx.params;

    const body = await req.json();
    const allowedFields = ['label', 'abbreviation', 'description', 'sequence', 'isActive', 'factoryGroup'];

    const update: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'abbreviation') {
          update[field] = String(body[field]).trim().toUpperCase();
        } else if (field === 'label') {
          update[field] = String(body[field]).trim();
        } else if (field === 'factoryGroup') {
          const value = String(body[field]).trim();
          update[field] = Object.values(FactoryGroup).includes(value as FactoryGroup)
            ? value
            : FactoryGroup.INSIDE;
        } else {
          update[field] = body[field];
        }
      }
    }

    const updated = await DepartmentModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  },
  [UserRole.SUPER_ADMIN]
);

// DELETE /api/departments/[id]
export const DELETE = withAuth(
  async (_req: NextRequest, ctx) => {
    await connectDB();
    const { id } = await ctx.params;

    const department = await DepartmentModel.findById(id);
    if (!department) {
      return NextResponse.json({ success: false, error: 'Department not found' }, { status: 404 });
    }

    const deptName = department.name;

    // Check for users assigned to this department
    const usersInDept = await UserModel.countDocuments({ department: deptName, isActive: true });
    if (usersInDept > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete "${department.label}": ${usersInDept} active user(s) are assigned to this department. Reassign them first.`,
        },
        { status: 400 }
      );
    }

    // Tasks in the department are deleted along with it instead of blocking
    // the delete. They are hard-deleted together with their comments, exactly
    // like DELETE /api/tasks/[id], and each affected project's completion
    // percentage is recalculated afterwards.
    const tasksInDept = await TaskModel.find({ department: deptName })
      .select('projectId')
      .lean();

    const affectedProjects = new Set<string>();
    for (const task of tasksInDept) {
      if (task.projectId) affectedProjects.add(String(task.projectId));
    }

    if (tasksInDept.length > 0) {
      const taskIds = tasksInDept.map((task) => task._id);
      await CommentModel.deleteMany({ taskId: { $in: taskIds } });
      await TaskModel.deleteMany({ _id: { $in: taskIds } });
    }

    await DepartmentModel.findByIdAndDelete(id);

    // Best-effort: the department and its tasks are already gone, so a failure
    // to recompute completion must not surface as a failed delete.
    for (const projectId of affectedProjects) {
      try {
        await updateProjectCompletion(projectId);
      } catch (completionError) {
        console.error(
          `[departments] Failed to recompute completion for project ${projectId}:`,
          completionError
        );
      }
    }

    return NextResponse.json({
      success: true,
      message:
        tasksInDept.length > 0
          ? `Department "${department.label}" and ${tasksInDept.length} task(s) have been deleted.`
          : `Department "${department.label}" has been deleted.`,
      data: { deletedTasks: tasksInDept.length },
    });
  },
  [UserRole.SUPER_ADMIN]
);