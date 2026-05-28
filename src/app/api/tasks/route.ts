import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TaskModel from '@/models/Task';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';
import { CreateTaskSchema } from '@/lib/validations';

// GET /api/tasks?projectId=xxx&department=xxx&status=xxx&page=1&limit=100
export const GET = withAuth(async (req: NextRequest, _ctx, { user }) => {
  await connectDB();

  const projectId = req.nextUrl.searchParams.get('projectId');
  const department = req.nextUrl.searchParams.get('department');
  const status = req.nextUrl.searchParams.get('status');
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || '100', 10)));
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};

  if (projectId) query.projectId = projectId;
  if (department) query.department = department;
  if (status) query.status = status;

  // Department users only see their dept tasks + either assigned to them or unassigned
  if (user.role === UserRole.DEPARTMENT_USER) {
    query.department = user.department;
    query.$or = [{ assignedUser: user._id }, { assignedUser: null }];
  }

  // Run query with pagination - only select needed fields initially
  const [tasks, total] = await Promise.all([
    TaskModel.find(query)
      .select('projectId department title description status frequency assignedUser dependencyTaskId isLocked sequence startDate dueDate completedAt createdAt updatedAt')
      .populate('assignedUser', 'name email department avatar')
      .populate('dependencyTaskId', 'title status department')
      .sort({ sequence: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    TaskModel.countDocuments(query),
  ]);

  return NextResponse.json({
    success: true,
    data: tasks,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + tasks.length < total,
    },
  });
});

// POST /api/tasks
export const POST = withAuth(async (req: NextRequest) => {
  await connectDB();

  const body = await req.json();
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const taskData = {
    ...parsed.data,
    startDate: parsed.data.startDate || undefined,
    dueDate: parsed.data.dueDate || undefined,
  };

  // Use lean with projection for maxLastSequence - only reads 1 field from 1 doc
  const lastTask = await TaskModel.findOne({
    projectId: taskData.projectId || null,
    department: taskData.department,
  })
    .sort({ sequence: -1 })
    .select('sequence')
    .lean();

  const newTask = await TaskModel.create({
    ...taskData,
    sequence: (lastTask?.sequence ?? 0) + 1,
  });

  return NextResponse.json({ success: true, data: newTask });
});