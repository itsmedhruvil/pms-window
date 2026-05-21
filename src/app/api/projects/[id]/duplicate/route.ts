import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ProjectModel from '@/models/Project';
import TaskModel from '@/models/Task';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';

// POST /api/projects/[id]/duplicate
export const POST = withAuth(
  async (_req: NextRequest, ctx, { user: _user }) => {
    await connectDB();
    const params = await ctx.params;
    const { id } = params;

    const originalProject = await ProjectModel.findById(id);
    if (!originalProject) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    // Create duplicate project
    const duplicateProject = new ProjectModel({
      ...originalProject.toObject(),
      _id: undefined, // Let MongoDB generate new ID
      projectTitle: `Copy of ${originalProject.projectTitle}`,
      status: 'not_started',
      startDate: null,
      completedAt: null,
      activeAlertIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedProject = await duplicateProject.save();

    // Duplicate all tasks
    const originalTasks = await TaskModel.find({ projectId: id });
    const duplicateTasks = originalTasks.map(task => ({
      ...task.toObject(),
      _id: undefined,
      projectId: savedProject._id,
      title: `Copy of ${task.title}`,
      status: 'not_started',
      assignedUser: null,
      startDate: null,
      completedAt: null,
      isLocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const savedTasks = await TaskModel.insertMany(duplicateTasks);

    return NextResponse.json({ success: true, data: { project: savedProject, tasks: savedTasks } });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
);