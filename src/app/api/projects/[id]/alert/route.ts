import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import AlertModel from '@/models/Alert';
import ProjectModel from '@/models/Project';
import { withAuth } from '@/lib/auth';
import { CreateAlertSchema } from '@/lib/validations';
import { AlertStatus, UserRole } from '@/types';
import { applyAlertEffects, createSystemLog } from '@/lib/workflow';
import { NotificationType } from '@/types/notifications';
import { notifyUsers } from '@/lib/notifications';

// POST /api/projects/[id]/alert — convenience endpoint to raise alert with projectId in URL
export const POST = withAuth(
  async (req: NextRequest, ctx, { user }) => {
    await connectDB();
    const params = await ctx.params;
    const { id: projectId } = params;

    const project = await ProjectModel.findById(projectId);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = CreateAlertSchema.safeParse({ ...body, projectId });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const alert = await AlertModel.create({
      ...parsed.data,
      raisedBy: user._id,
      status: AlertStatus.ACTIVE,
      acknowledgedBy: [],
    });

    await applyAlertEffects(alert._id.toString());

    await createSystemLog({
      alertId: alert._id.toString(),
      content: `Alert raised by ${user.name}: [${parsed.data.type}] ${parsed.data.severity} severity — "${parsed.data.message.slice(0, 60)}${parsed.data.message.length > 60 ? '…' : ''}"`,
      authorId: user._id.toString(),
    });

    const populated = await AlertModel.findById(alert._id)
      .populate('raisedBy', 'name email')
      .populate('projectId', 'projectTitle clientName')
      .lean();

    // Fire-and-forget: push notification via OneSignal to affected departments + admins
    if (populated) {
      const projectTitle =
        populated.projectId && typeof populated.projectId === 'object' && 'projectTitle' in populated.projectId
          ? (populated.projectId as unknown as { projectTitle: string }).projectTitle || 'Project'
          : 'Project';

      const alertTypeLabel = (parsed.data.type || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

      const UserModel = (await import('@/models/User')).default;
      const deptUsers = await UserModel.find({
        department: { $in: parsed.data.affectedDepartments },
        isActive: true,
      }).select('_id').lean();
      const admins = await UserModel.find({
        role: { $in: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
        isActive: true,
      }).select('_id').lean();

      const allUserIds = [
        ...new Set([
          ...deptUsers.map((u) => u._id.toString()),
          ...admins.map((a) => a._id.toString()),
        ]),
      ];

      if (allUserIds.length > 0) {
        await notifyUsers({
          type: NotificationType.ALERT_CREATED,
          title: `🚨 ${alertTypeLabel} Alert Raised`,
          body: `Alert in "${projectTitle}": ${populated.message?.slice(0, 150) || 'No details'}`,
          link: `/projects/${projectId}`,
          userIds: allUserIds,
          metadata: {
            alertId: populated._id.toString(),
            alertType: parsed.data.type,
            severity: parsed.data.severity,
            projectTitle,
          },
        });
      }
    }

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
);

// GET /api/projects/[id]/alert — list alerts for a project
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  await connectDB();
  const params = await ctx.params;
  const { id: projectId } = params;

  const alerts = await AlertModel.find({ projectId })
    .populate('raisedBy', 'name email')
    .populate('acknowledgedBy', 'name department')
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ success: true, data: alerts });
});
