import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ProjectModel from '@/models/Project';
import TaskModel from '@/models/Task';
import AlertModel from '@/models/Alert';
import { withAuth } from '@/lib/auth';
import { UpdateProjectSchema } from '@/lib/validations';
import { UserRole, ProjectStatus } from '@/types';

// GET /api/projects/[id]
export const GET = withAuth(async (_req: NextRequest, ctx) => {
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

  // Fetch related tasks and alerts
  const [tasks, alerts] = await Promise.all([
    TaskModel.find({ projectId: id })
      .populate('assignedUser', 'name email department')
      .sort({ sequence: 1 })
      .lean(),
    AlertModel.find({ projectId: id })
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
  async (req: NextRequest, ctx) => {
    await connectDB();
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

    const updated = await ProjectModel.findByIdAndUpdate(
      id,
      { $set: parsed.data },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email department');

    return NextResponse.json({ success: true, data: updated });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
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

    if (project.status === ProjectStatus.IN_PRODUCTION) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete a project that is in production' },
        { status: 400 }
      );
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
