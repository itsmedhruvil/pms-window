import connectDB from '@/lib/db';
import TaskModel from '@/models/Task';
import TaskTemplateModel from '@/models/TaskTemplate';
import { TaskStatus, TaskFrequency, Department } from '@/types';

/**
 * Generate recurring internal tasks based on TaskTemplates with frequency
 * daily, weekly, or monthly. For each template, checks if a task for the
 * current period already exists. If not, creates one.
 *
 * Daily   → 1 task per day (check by date)
 * Weekly  → 1 task per week (check by Monday)
 * Monthly → 1 task per month (check by month; respects "due N" day references)
 */
export async function generateRecurringInternalTasks(): Promise<{
  created: number;
  skipped: number;
}> {
  await connectDB();

  const now = new Date();

  // Period boundaries
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const recurringFrequencies: TaskFrequency[] = [
    TaskFrequency.DAILY,
    TaskFrequency.WEEKLY,
    TaskFrequency.MONTHLY,
  ];

  const templates = await TaskTemplateModel.find({
    frequency: { $in: recurringFrequencies },
    isActive: true,
  })
    .sort({ department: 1, sequence: 1 })
    .lean();

  let created = 0;
  let skipped = 0;

  for (const template of templates) {
    let dueDate: Date;
    let existingQueryStart: Date;
    let existingQueryEnd: Date;

    switch (template.frequency) {
      case TaskFrequency.DAILY:
        dueDate = new Date(todayEnd);
        existingQueryStart = todayStart;
        existingQueryEnd = todayEnd;
        break;
      case TaskFrequency.WEEKLY:
        dueDate = new Date(weekEnd);
        existingQueryStart = weekStart;
        existingQueryEnd = weekEnd;
        break;
      case TaskFrequency.MONTHLY:
        dueDate = new Date(monthEnd);
        existingQueryStart = monthStart;
        existingQueryEnd = monthEnd;
        break;
      default:
        continue;
    }

    // Parse "due N" / "Nth of month" for monthly tasks
    let specificDayDueDate: Date | null = null;
    if (template.frequency === TaskFrequency.MONTHLY) {
      const dayMatch =
        template.title.match(/due\s+(\d+)/i) ||
        template.description.match(/due\s+(\d+)/i) ||
        template.title.match(/(\d+)(st|nd|rd|th)\s+of/i) ||
        template.description.match(/(\d+)(st|nd|rd|th)\s+of/i);
      if (dayMatch) {
        const day = parseInt(dayMatch[1], 10);
        if (day >= 1 && day <= 31) {
          const targetMonth = now.getDate() > day ? now.getMonth() + 1 : now.getMonth();
          const actualYear = now.getFullYear();
          const actualMonth = targetMonth > 11 ? 0 : targetMonth;
          const actualFullYear = targetMonth > 11 ? actualYear + 1 : actualYear;
          specificDayDueDate = new Date(actualFullYear, actualMonth, day);
          specificDayDueDate.setHours(23, 59, 59, 999);
        }
      }
    }

    // Check if a task already exists for this template in the current period
    const existingTask = await TaskModel.findOne({
      templateTaskId: template._id,
      projectId: null,
      createdAt: { $gte: existingQueryStart, $lt: existingQueryEnd },
    }).lean();

    if (existingTask) {
      skipped++;
      continue;
    }

    await TaskModel.create({
      department: template.department as Department,
      templateTaskId: template._id,
      title: template.title,
      description: template.description,
      status: TaskStatus.TODO,
      frequency: template.frequency,
      dueDate: specificDayDueDate || dueDate,
      isLocked: false,
      sequence: template.sequence,
    });

    created++;
  }

  return { created, skipped };
}