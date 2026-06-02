import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ProjectModel from '@/models/Project';
import { withAuth } from '@/lib/auth';
import { CreateProjectSchema, ProjectFiltersSchema } from '@/lib/validations';
import { generateProjectTasks, generateFromSelectedTemplateGroup } from '@/lib/workflow';
import { ProjectStatus, UserRole } from '@/types';
import mongoose from 'mongoose';
import { createSystemLog } from '@/lib/workflow';
import { sendPushToOneSignalUsers } from '@/lib/onesignal';

// GET /api/projects - List projects with filters
export const GET = withAuth(async (req: NextRequest, _ctx, { user }) => {
  await connectDB();
  void user;

  const searchParams = Object.fromEntries(req.nextUrl.searchParams);
  const filters = ProjectFiltersSchema.safeParse(searchParams);

  if (!filters.success) {
    return NextResponse.json(
      { success: false, error: filters.error.flatten() },
      { status: 400 }
    );
  }

  const { status, priority, search, page, limit } = filters.data;
  const skip = (page - 1) * limit;

  // Build query
  const query: Record<string, unknown> = {};

  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (search) {
    // Use $regex for now (text index requires specific setup)
    // If the text index exists, this will still work with $regex
    query.$or = [
      { clientName: { $regex: search, $options: 'i' } },
      { projectTitle: { $regex: search, $options: 'i' } },
    ];
  }

  // Use hint to ensure the query planner picks the right index
  const sortOption = { priority: -1 as const, deadline: 1 as const, createdAt: -1 as const };
  const findQuery = ProjectModel.find(query)
    .sort(sortOption)
    .skip(skip)
    .limit(limit)
    .populate('createdBy', 'name email department')
    .lean();

  const [items, total] = await Promise.all([
    findQuery,
    ProjectModel.countDocuments(query),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// POST /api/projects - Create project
export const POST = withAuth(
  async (req: NextRequest, _ctx, { user }) => {
    await connectDB();

    const body = await req.json();
    const parsed = CreateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const projectData = parsed.data;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const [project] = await ProjectModel.create(
        [
          {
            ...projectData,
            createdBy: user._id,
            status: ProjectStatus.NEW,
            completionPercentage: 0,
          },
        ],
        { session }
      );

      // Auto-generate workflow tasks:
      // 1. If a selectedTemplateGroupId is provided, generate department tasks from that template group
      // 2. If window specifications with template groups exist (per-spec), generate per-window tasks
      // 3. Otherwise generate from active task templates (fallback)
      if (projectData.selectedTemplateGroupId) {
        // Use the global template group for task generation (handles linkedToProduct multiplication)
        await generateFromSelectedTemplateGroup(
          project._id,
          user._id,
          projectData.selectedTemplateGroupId
        );
      } else if (projectData.windowSpecifications && projectData.windowSpecifications.length > 0) {
        await generateProjectTasks(
          project._id,
          user._id,
          projectData.windowSpecifications.map((ws) => ({
            templateGroupId: ws.templateGroupId,
            design: ws.design,
            quantity: ws.quantity,
          }))
        );
      } else {
        await generateProjectTasks(project._id, user._id);
      }

      // Create system log
      await createSystemLog({
        content: `Project "${project.projectTitle}" created for ${project.clientName}. Workflow tasks auto-generated.`,
        authorId: user._id.toString(),
      });

      await session.commitTransaction();

      const populated = await ProjectModel.findById(project._id)
        .populate('createdBy', 'name email department')
        .lean();

      // Fire-and-forget: push notification via OneSignal to all active users
      if (populated) {
        const UserModel = (await import('@/models/User')).default;
        const allUsers = await UserModel.find({ isActive: true }).select('_id').lean();
        const allUserIds = allUsers.map((u) => u._id.toString());
        if (allUserIds.length > 0) {
          sendPushToOneSignalUsers(
            allUserIds,
            `New Project: ${populated.projectTitle}`,
            `"${populated.projectTitle}" was created for client "${populated.clientName}". Check your tasks.`,
            `/projects/${populated._id}`
          ).catch(() => {});
        }
      }

      return NextResponse.json({ success: true, data: populated }, { status: 201 });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
);
