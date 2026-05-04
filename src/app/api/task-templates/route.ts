import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TaskTemplateModel from '@/models/TaskTemplate';
import { withAuth } from '@/lib/auth';
import { CreateTaskTemplateSchema } from '@/lib/validations';
import { UserRole } from '@/types';

export const GET = withAuth(async (req: NextRequest) => {
  await connectDB();

  const department = req.nextUrl.searchParams.get('department');
  const query = department ? { department } : {};

  const templates = await TaskTemplateModel.find(query)
    .sort({ department: 1, sequence: 1, createdAt: 1 })
    .lean();

  return NextResponse.json({ success: true, data: templates });
});

export const POST = withAuth(
  async (req: NextRequest) => {
    await connectDB();

    const body = await req.json();
    const parsed = CreateTaskTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const sequence =
      data.sequence ??
      ((await TaskTemplateModel.findOne({ department: data.department })
        .sort({ sequence: -1 })
        .select('sequence')
        .lean())?.sequence ?? -1) + 1;

    const template = await TaskTemplateModel.create({
      ...data,
      sequence,
      isActive: data.isActive ?? true,
    });

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
);
