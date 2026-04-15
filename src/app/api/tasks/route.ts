import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TaskModel from '@/models/Task';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';
import { CreateTaskSchema } from '@/lib/validations';

// GET /api/tasks?projectId=xxx&department=xxx&status=xxx
export const GET = withAuth(async (req: NextRequest, _ctx, { user }) => {
  await connectDB();

  const projectId = req.nextUrl.searchParams.get('projectId');
  const department = req.nextUrl.searchParams.get('department');
  const status = req.nextUrl.searchParams.get('status');

  const query: Record<string, unknown> = {};

  if (projectId) query.projectId = projectId;
  if (department) query.department = department;
  if (status) query.status = status;

  // Department users only see their dept tasks + either assigned to them or unassigned
  if (user.role === UserRole.DEPARTMENT_USER) {
    query.department = user.department;
    query.$or = [{ assignedUser: user._id }, { assignedUser: null }];
  }

  const tasks = await TaskModel.find(query)
    .populate('assignedUser', 'name email department avatar')
    .populate('dependencyTaskId', 'title status department')
    .sort({ sequence: 1 })
    .lean();

  return NextResponse.json({ success: true, data: tasks });
});

// POST /api/tasks
export const POST = withAuth(async (req: NextRequest) => {
  await connectDB();

  const body = await req.json();
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const newTask = await TaskModel.create(parsed.data);
  return NextResponse.json({ success: true, data: newTask });
});
