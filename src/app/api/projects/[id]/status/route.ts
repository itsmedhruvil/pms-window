import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import connectDB from '@/lib/db';
import ProjectModel from '@/models/Project';
import TaskModel from '@/models/Task';
import AlertModel from '@/models/Alert';
import { withAuth } from '@/lib/auth';
import { ProjectStatus, AlertStatus, TaskStatus, UserRole } from '@/types';
import { createSystemLog } from '@/lib/workflow';

const StatusSchema = z.object({
  status: z.nativeEnum(ProjectStatus),
  note: z.string().optional(),
});

// Valid admin-triggered transitions
const ALLOWED_TRANSITIONS: Partial<Record<ProjectStatus, ProjectStatus[]>> = {
  [ProjectStatus.NEW]: [ProjectStatus.IN_PRODUCTION],
  [ProjectStatus.IN_PRODUCTION]: [ProjectStatus.ON_HOLD, ProjectStatus.COMPLETED],
  [ProjectStatus.ON_HOLD]: [ProjectStatus.IN_PRODUCTION],
  [ProjectStatus.COMPLETED]: [ProjectStatus.DISPATCHED],
};

// POST /api/projects/[id]/status
export const POST = withAuth(
  async (req: NextRequest, ctx, { user }) => {
    await connectDB();
    const { id } = await ctx.params;

    const body = await req.json();
    const parsed = StatusSchema.safeParse(body);

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

    const { status: newStatus, note } = parsed.data;
    const currentStatus = project.status;

    // Validate transition
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowed.join(', ') || 'none'}`,
        },
        { status: 400 }
      );
    }

    // Guard: cannot complete if tasks remain
    if (newStatus === ProjectStatus.COMPLETED) {
      const incompleteTasks = await TaskModel.countDocuments({
        projectId: id,
        status: { $ne: TaskStatus.DONE },
      });
      if (incompleteTasks > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot complete project: ${incompleteTasks} task(s) are not done`,
          },
          { status: 400 }
        );
      }
    }

    // Guard: cannot start production if unresolved alerts
    if (newStatus === ProjectStatus.IN_PRODUCTION) {
      const openAlerts = await AlertModel.countDocuments({
        projectId: id,
        status: { $ne: AlertStatus.RESOLVED },
      });
      if (openAlerts > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot resume production: ${openAlerts} unresolved alert(s) must be resolved first`,
          },
          { status: 400 }
        );
      }
    }

    project.status = newStatus;
    await project.save();

    const logMsg = note
      ? `Status changed to "${newStatus}" by ${user.name}: ${note}`
      : `Status changed from "${currentStatus}" to "${newStatus}" by ${user.name}`;

    await createSystemLog({
      content: logMsg,
      authorId: user._id.toString(),
    });

    const updated = await ProjectModel.findById(id)
      .populate('createdBy', 'name email')
      .lean();

    return NextResponse.json({ success: true, data: updated });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
);
