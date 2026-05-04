import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TaskTemplateModel from '@/models/TaskTemplate';
import { withAuth } from '@/lib/auth';
import { UpdateTaskTemplateSchema } from '@/lib/validations';
import { UserRole } from '@/types';

export const PATCH = withAuth(
  async (req: NextRequest, ctx) => {
    await connectDB();

    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = UpdateTaskTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const template = await TaskTemplateModel.findByIdAndUpdate(
      id,
      { $set: parsed.data },
      { new: true }
    ).lean();

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: template });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
);

export const DELETE = withAuth(
  async (_req: NextRequest, ctx) => {
    await connectDB();

    const { id } = await ctx.params;
    const template = await TaskTemplateModel.findByIdAndDelete(id).lean();

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Template deleted' });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
);
