import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ProjectModel from '@/models/Project';
import TaskModel from '@/models/Task';
import AlertModel from '@/models/Alert';
import { withAuth } from '@/lib/auth';
import { UpdateProjectSchema } from '@/lib/validations';
import { UserRole, ProjectStatus } from '@/types';

// GET /api/projects/[id]
export const GET = withAuth(async (_req: NextRequest, ctx, { user }) => {
  await connectDB();

  const params = await ctx.params;
  const { id } = params;

  const project = await ProjectModel.findById(id)
    .populate('createdBy', 'name email department')
    .populate('assignedUsers', 'name email department')
    .lean();

  if (!project) {
    return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
  }

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  const taskQuery: Record<string, unknown> = { projectId: id };
  const alertQuery: Record<string, unknown> = { projectId: id };

  if (!isAdmin) {
    taskQuery.department = user.department;
    alertQuery.affectedDepartments = user.department;
  }

  // Fetch related tasks and alerts
  const [tasks, alerts] = await Promise.all([
    TaskModel.find(taskQuery)
      .populate('assignedUser', 'name email department')
      .sort({ sequence: 1 })
      .lean(),
    AlertModel.find(alertQuery)
      .populate('raisedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  return NextResponse.json({
    success: true,
    data: { project, tasks, alerts },
  });
});

// PATCH /api/projects/[id]
export const PATCH = withAuth(
  async (req: NextRequest, ctx, { user }) => {
    await connectDB();
    try {
      const params = await ctx.params;
      const { id } = params;

      const body = await req.json();
      const parsed = UpdateProjectSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const project = await ProjectModel.findById(id);
      if (!project) {
        return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
      }

      const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;

      // Restrict attachment/windowSpec changes to admin only
      if (!isAdmin) {
        if (parsed.data.pdfAttachments !== undefined ||
            parsed.data.windowSpecifications !== undefined ||
            parsed.data.excelRows !== undefined ||
            parsed.data.excelSheetName !== undefined) {
          return NextResponse.json(
            { success: false, error: 'Only admins can modify attachments and specifications' },
            { status: 403 }
          );
        }
      }

      // Validate status transitions
      if (parsed.data.status) {
        const newStatus = parsed.data.status;
        // Cannot complete if tasks are pending
        if (newStatus === ProjectStatus.COMPLETED) {
          const incompleteTasks = await TaskModel.countDocuments({
            projectId: id,
            status: { $ne: 'done' },
          });
          if (incompleteTasks > 0) {
            return NextResponse.json(
              {
                success: false,
                error: `Cannot complete project: ${incompleteTasks} task(s) still pending`,
              },
              { status: 400 }
            );
          }
        }

        // Cannot change status if active alerts
        if (project.activeAlertIds.length > 0 && newStatus !== ProjectStatus.ON_HOLD) {
          return NextResponse.json(
            {
              success: false,
              error: 'Cannot change project status while active alerts exist',
            },
            { status: 400 }
          );
        }
      }

      const updateData = { ...parsed.data } as Record<string, unknown>;
      delete updateData._id;

      if (updateData.excelFile === null || updateData.excelFile === undefined) {
        // Handle null/undefined excelFile - unset it and set everything else
        const { excelFile: _, ...setData } = updateData;
        const updated = await ProjectModel.findByIdAndUpdate(
          id,
          { $set: setData, ...(parsed.data.excelFile === null ? { $unset: { excelFile: '' } } : {}) },
          { new: true }
        ).populate('createdBy', 'name email department');
        if (!updated) {
          return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: updated });
      }

      const updated = await ProjectModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
      ).populate('createdBy', 'name email department');

      if (!updated) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: updated });
    } catch (error) {
      console.error('[Project PATCH] Error:', error);
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to update project' },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DEPARTMENT_USER]
);

// DELETE /api/projects/[id]
export const DELETE = withAuth(
  async (_req: NextRequest, ctx) => {
    await connectDB();
    const params = await ctx.params;
    const { id } = params;

    const project = await ProjectModel.findById(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    // Cascade delete tasks, alerts, comments
    await Promise.all([
      TaskModel.deleteMany({ projectId: id }),
      AlertModel.deleteMany({ projectId: id }),
    ]);

    await ProjectModel.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'Project deleted' });
  },
  [UserRole.SUPER_ADMIN]
);