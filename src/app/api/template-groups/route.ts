import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TemplateGroupModel from '@/models/TemplateGroup';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';
import type { IUserDocument } from '@/models/User';

// GET /api/template-groups - List all template groups
async function getHandler(req: NextRequest, _ctx: unknown, { user }: { user: IUserDocument }) {
  await connectDB();

  const groups = await TemplateGroupModel.find({ isActive: true })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ success: true, data: groups });
}

// POST /api/template-groups - Create a new template group
async function postHandler(
  req: NextRequest,
  _ctx: unknown,
  { user }: { user: IUserDocument }
) {
  if (user.role === UserRole.DEPARTMENT_USER) {
    return NextResponse.json({ success: false, error: 'Only admins can manage template groups' }, { status: 403 });
  }

  await connectDB();

  const body = await req.json();
  const { name, description, tasks } = body;

  if (!name || name.trim().length < 3) {
    return NextResponse.json({ success: false, error: 'Name must be at least 3 characters' }, { status: 400 });
  }

  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ success: false, error: 'At least one task is required' }, { status: 400 });
  }

  // Validate each task
  for (const task of tasks) {
    if (!task.department || !task.title || !task.description) {
      return NextResponse.json({ success: false, error: 'Each task must have department, title, and description' }, { status: 400 });
    }
  }

  // Check for duplicate name
  const existing = await TemplateGroupModel.findOne({ name: name.trim() });
  if (existing) {
    return NextResponse.json({ success: false, error: 'A template group with this name already exists' }, { status: 409 });
  }

  const group = await TemplateGroupModel.create({
    name: name.trim(),
    description: description?.trim() || '',
      tasks: tasks.map((t: { department: string; title: string; description: string; frequency?: string }, i: number) => ({
        department: t.department,
        title: t.title.trim(),
        description: t.description.trim(),
        sequence: i,
        frequency: t.frequency || 'project',
      })),
  });

  return NextResponse.json({ success: true, data: group }, { status: 201 });
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);