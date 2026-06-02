import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TemplateGroupModel from '@/models/TemplateGroup';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';
import type { IUserDocument } from '@/models/User';

// PATCH /api/template-groups/[id] - Update a template group
async function patchHandler(
  req: NextRequest,
  context: { params: Promise<Record<string, string>> },
  { user }: { user: IUserDocument }
) {
  if (user.role === UserRole.DEPARTMENT_USER) {
    return NextResponse.json({ success: false, error: 'Only admins can manage template groups' }, { status: 403 });
  }

  await connectDB();

  const params = await context.params;
  const { id } = params;
  const body = await req.json();
  const { name, description, tasks } = body;

  if (!name || name.trim().length < 3) {
    return NextResponse.json({ success: false, error: 'Name must be at least 3 characters' }, { status: 400 });
  }

  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ success: false, error: 'At least one task is required' }, { status: 400 });
  }

  for (const task of tasks) {
    if (!task.department || !task.title || !task.description) {
      return NextResponse.json({ success: false, error: 'Each task must have department, title, and description' }, { status: 400 });
    }
  }

  const group = await TemplateGroupModel.findByIdAndUpdate(
    id,
    {
      name: name.trim(),
      description: description?.trim() || '',
      tasks: tasks.map((t: { department: string; title: string; description: string; frequency?: string; type?: string; linkedToProduct?: boolean }, i: number) => ({
        department: t.department,
        title: t.title.trim(),
        description: t.description.trim(),
        sequence: i,
        frequency: t.frequency || 'project',
        type: t.type || 'project',
        linkedToProduct: t.linkedToProduct === true,
      })),
    },
    { new: true }
  );

  if (!group) {
    return NextResponse.json({ success: false, error: 'Template group not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: group });
}

// DELETE /api/template-groups/[id] - Delete a template group
async function deleteHandler(
  req: NextRequest,
  context: { params: Promise<Record<string, string>> },
  { user }: { user: IUserDocument }
) {
  if (user.role === UserRole.DEPARTMENT_USER) {
    return NextResponse.json({ success: false, error: 'Only admins can manage template groups' }, { status: 403 });
  }

  await connectDB();

  const params = await context.params;
  const { id } = params;

  const group = await TemplateGroupModel.findByIdAndDelete(id);
  if (!group) {
    return NextResponse.json({ success: false, error: 'Template group not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { id } });
}

export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);