import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import AlertModel from '@/models/Alert';
import UserModel from '@/models/User';
import { withAuth } from '@/lib/auth';
import { CreateAlertSchema } from '@/lib/validations';
import { AlertStatus, UserRole } from '@/types';
import { applyAlertEffects, createSystemLog } from '@/lib/workflow';
import { notifyUsers } from '@/lib/notifications';
import { NotificationType } from '@/types/notifications';

// GET /api/alerts
export const GET = withAuth(async (req: NextRequest, _ctx, { user }) => {
  await connectDB();

  const projectId = req.nextUrl.searchParams.get('projectId');
  const status = req.nextUrl.searchParams.get('status');
  const taskId = req.nextUrl.searchParams.get('taskId');
  const type = req.nextUrl.searchParams.get('type');

  const query: Record<string, unknown> = {};
  if (projectId) query.projectId = projectId;
  if (status) query.status = status;
  if (taskId) query.taskId = taskId;
  if (type) query.type = type;

  // Department users only see alerts affecting their department
  if (user.role === UserRole.DEPARTMENT_USER) {
    query.affectedDepartments = user.department;
  }

  const alerts = await AlertModel.find(query)
    .populate('raisedBy', 'name email department')
    .populate('projectId', 'projectTitle clientName')
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ success: true, data: alerts });
});

// POST /api/alerts - Admin only (or any user for DISCUSSIONS)
export const POST = withAuth(
  async (req: NextRequest, _ctx, { user }) => {
    await connectDB();

    const body = await req.json();
    const parsed = CreateAlertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (user.role === UserRole.DEPARTMENT_USER) {
      return NextResponse.json(
        { success: false, error: 'Only admins can create alerts' },
        { status: 403 }
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
      content: `Alert raised by ${user.name}: ${parsed.data.type} - ${parsed.data.severity} severity`,
      authorId: user._id.toString(),
    });

    const populated = await AlertModel.findById(alert._id)
      .populate('raisedBy', 'name email department')
      .populate('projectId', 'projectTitle clientName')
      .lean();

    // Notify admins and every user in an affected department.
    try {
      const recipients = await UserModel.find({
        isActive: true,
        $or: [
          { role: { $in: [UserRole.SUPER_ADMIN, UserRole.ADMIN] } },
          { department: { $in: parsed.data.affectedDepartments } },
        ],
      })
        .select('_id')
        .lean();

      const projectTitle =
        populated?.projectId &&
        typeof populated.projectId === 'object' &&
        'projectTitle' in populated.projectId
          ? (populated.projectId as { projectTitle?: string }).projectTitle
          : undefined;

      await notifyUsers({
        type: NotificationType.ALERT_CREATED,
        title: `New ${parsed.data.severity} alert`,
        body: `${user.name} raised an alert${projectTitle ? ` on "${projectTitle}"` : ''}: ${parsed.data.message}`,
        link: '/alerts',
        userIds: recipients.map((u) => u._id.toString()),
        excludeUserIds: [user._id.toString()],
        metadata: {
          alertId: alert._id.toString(),
          projectId: parsed.data.projectId,
          severity: parsed.data.severity,
          alertType: parsed.data.type,
          departments: parsed.data.affectedDepartments,
        },
      });
    } catch (error) {
      console.error('[alerts] Failed to dispatch notifications:', error);
    }

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DEPARTMENT_USER]
);
