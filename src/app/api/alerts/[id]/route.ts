 import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import AlertModel from '@/models/Alert';
import { withAuth } from '@/lib/auth';
import { AlertStatus, UserRole } from '@/types';
import { resolveAlertEffects, createSystemLog } from '@/lib/workflow';
import type { IUserDocument } from '@/models/User';

// PATCH /api/alerts/[id] - acknowledge or resolve
async function patchHandler(
  req: NextRequest,
  context: { params: Promise<Record<string, string>> },
  { user }: { user: IUserDocument }
) {
  await connectDB();

  const params = await context.params;
  const { id } = params;
  const body = await req.json();
  const { action } = body; // 'acknowledge' | 'resolve'

  const alert = await AlertModel.findById(id);
  if (!alert) {
    return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
  }

  if (action === 'acknowledge') {
    // Any user in affected department can acknowledge
    if (
      user.role === UserRole.DEPARTMENT_USER &&
      !alert.affectedDepartments.includes(user.department)
    ) {
      return NextResponse.json(
        { success: false, error: 'Your department is not affected by this alert' },
        { status: 403 }
      );
    }

    if (alert.acknowledgedBy.includes(user._id)) {
      return NextResponse.json(
        { success: false, error: 'You have already acknowledged this alert' },
        { status: 400 }
      );
    }

    alert.acknowledgedBy.push(user._id);

    // Check if all affected depts have acknowledged
    // (simplified: if acknowledgedBy has at least one user)
    if (alert.status === AlertStatus.ACTIVE) {
      alert.status = AlertStatus.ACKNOWLEDGED;
    }

    await alert.save();

    await createSystemLog({
      alertId: id,
      content: `Alert acknowledged by ${user.name} (${user.department})`,
      authorId: user._id.toString(),
    });
  } else if (action === 'resolve') {
    // Only admin can resolve
    if (user.role === UserRole.DEPARTMENT_USER) {
      return NextResponse.json(
        { success: false, error: 'Only admins can resolve alerts' },
        { status: 403 }
      );
    }

    if (alert.status === AlertStatus.ACTIVE) {
      return NextResponse.json(
        { success: false, error: 'Alert must be acknowledged before resolving' },
        { status: 400 }
      );
    }

    // Check if comment thread exists (required before resolution)
    const CommentModel = (await import('@/models/Comment')).default;
    const commentCount = await CommentModel.countDocuments({ alertId: id });
    if (commentCount < 2) {
      return NextResponse.json(
        { success: false, error: 'Alert must have a comment discussion before resolution' },
        { status: 400 }
      );
    }

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = new Date();
    alert.resolvedBy = user._id;
    await alert.save();

    await resolveAlertEffects(id);

    await createSystemLog({
      alertId: id,
      content: `Alert resolved by ${user.name}. Workflow restored.`,
      authorId: user._id.toString(),
    });
  } else {
    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "acknowledge" or "resolve"' },
      { status: 400 }
    );
  }

  const updated = await AlertModel.findById(id)
    .populate('raisedBy', 'name email')
    .populate('acknowledgedBy', 'name department')
    .lean();

  return NextResponse.json({ success: true, data: updated });
}

export const PATCH = withAuth(patchHandler);
