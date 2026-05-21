import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import AlertModel from '@/models/Alert';
import { withAuth } from '@/lib/auth';
import { CreateAlertSchema } from '@/lib/validations';
import { AlertStatus, UserRole } from '@/types';
import { applyAlertEffects, createSystemLog } from '@/lib/workflow';

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

    // Department users cannot create alerts directly (admin only)
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

    // Apply workflow effects
    await applyAlertEffects(alert._id.toString());

    // System log
    await createSystemLog({
      alertId: alert._id.toString(),
      content: `Alert raised by ${user.name}: ${parsed.data.type} - ${parsed.data.severity} severity`,
      authorId: user._id.toString(),
    });

    const populated = await AlertModel.findById(alert._id)
      .populate('raisedBy', 'name email department')
      .populate('projectId', 'projectTitle clientName')
      .lean();

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DEPARTMENT_USER]
);
