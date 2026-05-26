import { NextResponse } from 'next/server';
import { checkAndNotifyOverdueTasks } from '@/lib/notifications';

// GET or POST — Vercel Cron sends GET requests
export const GET = async () => {
  try {
    const count = await checkAndNotifyOverdueTasks();
    return NextResponse.json({
      success: true,
      data: { notificationsCreated: count },
    });
  } catch (error) {
    console.error('[Cron check-overdue Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check overdue tasks' },
      { status: 500 }
    );
  }
};

export const POST = GET;