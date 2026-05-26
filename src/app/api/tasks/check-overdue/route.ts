import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';
import { checkAndNotifyOverdueTasks } from '@/lib/notifications';

// POST /api/tasks/check-overdue - Check and notify about overdue tasks
export const POST = withAuth(
  async (_req: NextRequest, _ctx, { user: _user }) => {
    const count = await checkAndNotifyOverdueTasks();

    return NextResponse.json({
      success: true,
      data: {
        notificationsCreated: count,
        message: `Created ${count} overdue task notification(s).`,
      },
    });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
);