 import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import AlertModel from '@/models/Alert';
import { withAuth } from '@/lib/auth';
import { AlertStatus, UserRole } from '@/types';
import { resolveAlertEffects, createSystemLog } from '@/lib/workflow';
import { notifyAdmins, notifyDepartment, createNotification } from '@/lib/notifications';
import type { IUserDocument } from '@/models/User';
import type { Department } from '@/types';

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

    // Check if ALL affected departments have at least one acknowledgment
    const acknowledgedUserIds = alert.acknowledgedBy;
    const UserModel = (await import('@/models/User')).default;
    const acknowledgedUsers = await UserModel.find({
      _id: { $in: acknowledgedUserIds },
    }).select('department').lean();

    const departmentsAcknowledged = new Set(
      acknowledgedUsers.map((u: { department: string }) => u.department)
    );

    const allDepartmentsAcknowledged = alert.affectedDepartments.every((dept) =>
      departmentsAcknowledged.has(dept)
    );

    if (allDepartmentsAcknowledged && alert.status === AlertStatus.ACTIVE) {
      alert.status = AlertStatus.ACKNOWLEDGED;
    }

    await alert.save();

    await createSystemLog({
      alertId: id,
      content: `Alert acknowledged by ${user.name} (${user.department})`,
      authorId: user._id.toString(),
    });

    // Fire-and-forget: notify admins about acknowledgment
    notifyAdmins({
      type: 'alert_acknowledged',
      title: `✅ Alert Acknowledged by ${user.department}`,
      message: `"${alert.type?.replace(/_/g, ' ') || 'Alert'}" acknowledged by ${user.name} (${user.department})`,
      relatedId: alert._id.toString(),
      relatedModel: 'Alert',
    }).catch(() => {});
  } else if (action === 'resolve') {
    // Only admins can resolve alerts
    if (user.role === UserRole.DEPARTMENT_USER) {
      return NextResponse.json(
        { success: false, error: 'Only admins can resolve alerts' },
        { status: 403 }
      );
    }

    // Ensure alert has been acknowledged before allowing resolution
    if (alert.status === AlertStatus.ACTIVE) {
      return NextResponse.json(
        { success: false, error: 'Alert must be acknowledged by all affected departments before resolving' },
        { status: 400 }
      );
    }

    // Require a discussion thread (at least two comments) before resolution
    const CommentModel = (await import('@/models/Comment')).default;
    const commentCount = await CommentModel.countDocuments({ alertId: id });
    if (commentCount < 2) {
      return NextResponse.json(
        { success: false, error: 'Alert must have a comment discussion before resolution' },
        { status: 400 }
      );
    }

    // Mark alert as resolved and record metadata
    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = new Date();
    alert.resolvedBy = user._id;
    await alert.save();

    // Restore workflow: unblock tasks, update project status, etc.
    await resolveAlertEffects(id);

    // Log the resolution event for audit purposes
    await createSystemLog({
      alertId: id,
      content: `Alert resolved by ${user.name}. Workflow restored.`,
      authorId: user._id.toString(),
    });

    // Fire-and-forget: notify affected departments that alert is resolved
    if (alert.affectedDepartments && alert.affectedDepartments.length > 0) {
      for (const dept of alert.affectedDepartments) {
        notifyDepartment(dept as Department, {
          type: 'alert_resolved',
          title: `✅ Alert Resolved`,
          message: `Alert "${alert.type?.replace(/_/g, ' ') || 'Alert'}" resolved by ${user.name}. Workflow restored.`,
          relatedId: alert._id.toString(),
          relatedModel: 'Alert',
        }).catch(() => {});
      }
    } else {
      notifyAdmins({
        type: 'alert_resolved',
        title: `✅ Alert Resolved`,
        message: `Alert resolved by ${user.name}. Workflow restored.`,
        relatedId: alert._id.toString(),
        relatedModel: 'Alert',
      }).catch(() => {});
    }
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

// DELETE /api/alerts/[id] - delete alert (admin only)
async function deleteHandler(
  req: NextRequest,
  context: { params: Promise<Record<string, string>> },
  { user }: { user: IUserDocument }
) {
  if (user.role === UserRole.DEPARTMENT_USER) {
    return NextResponse.json(
      { success: false, error: 'Only admins can delete alerts' },
      { status: 403 }
    );
  }

  await connectDB();

  const params = await context.params;
  const { id } = params;

  const alert = await AlertModel.findByIdAndDelete(id);
  if (!alert) {
    return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
  }

  // Also clean up associated comments
  const CommentModel = (await import('@/models/Comment')).default;
  await CommentModel.deleteMany({ alertId: id });

  return NextResponse.json({ success: true, data: { id } });
}

export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);
