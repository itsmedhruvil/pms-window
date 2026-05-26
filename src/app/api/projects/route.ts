import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ProjectModel from '@/models/Project';
import { withAuth } from '@/lib/auth';
import { CreateProjectSchema, ProjectFiltersSchema } from '@/lib/validations';
import { generateProjectTasks, generateFromSelectedTemplateGroup } from '@/lib/workflow';
import { ProjectStatus, UserRole } from '@/types';
import mongoose from 'mongoose';
import { createSystemLog } from '@/lib/workflow';
import { notifyAdmins, notifyDepartment } from '@/lib/notifications';

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

    // Validate total windows matches specs only when specs are provided
    if (projectData.windowSpecifications && projectData.windowSpecifications.length > 0) {
      const specTotal = projectData.windowSpecifications.reduce(
        (sum, spec) => sum + spec.quantity,
        0
      );
      if (specTotal !== projectData.totalWindows) {
        return NextResponse.json(
          {
            success: false,
            error: `Total windows (${projectData.totalWindows}) must match sum of specifications (${specTotal})`,
          },
          { status: 400 }
        );
      }
    }

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
      // 1. If window specifications with template groups exist, generate per-window tasks
      // 2. If a selectedTemplateGroupId is provided (but no window specs), generate department tasks from that template group
      // 3. Otherwise generate from active task templates (fallback)
      if (projectData.windowSpecifications && projectData.windowSpecifications.length > 0) {
        await generateProjectTasks(
          project._id,
          user._id,
          projectData.windowSpecifications.map((ws) => ({
            templateGroupId: ws.templateGroupId,
            design: ws.design,
            quantity: ws.quantity,
          }))
        );
      } else if (projectData.selectedTemplateGroupId) {
        await generateFromSelectedTemplateGroup(
          project._id,
          user._id,
          projectData.selectedTemplateGroupId
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

      // Fire-and-forget notifications - notify all admins about the new project
      if (populated) {
        notifyAdmins({
          type: 'project_created',
          title: 'New Project Created',
          message: `"${populated.projectTitle}" was created for client "${populated.clientName}".`,
          link: `/projects/${populated._id}`,
          relatedId: populated._id.toString(),
          relatedModel: 'Project',
        }).catch(() => {});

        // Notify all departments that have users
        import('@/models/User').then(({ default: UserModel }) => {
          UserModel.distinct('department', { isActive: true }).then((departments: string[]) => {
            for (const dept of departments) {
              notifyDepartment(dept as any, {
                type: 'project_created',
                title: 'New Project Created',
                message: `"${populated.projectTitle}" was created for "${populated.clientName}". Check your tasks.`,
                link: `/projects/${populated._id}`,
                relatedId: populated._id.toString(),
                relatedModel: 'Project',
              }).catch(() => {});
            }
          });
        });
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
