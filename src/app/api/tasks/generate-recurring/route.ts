import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';
import { generateRecurringInternalTasks } from '@/lib/generate-recurring';

/**
 * POST /api/tasks/generate-recurring
 *
 * Generates recurring internal tasks based on TaskTemplates with frequency
 * daily, weekly, or monthly. For each template, checks if a task for the
 * current period already exists. If not, creates one.
 */
export const POST = withAuth(
  async () => {
    const result = await generateRecurringInternalTasks();
    return NextResponse.json({ success: true, data: result });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
);
