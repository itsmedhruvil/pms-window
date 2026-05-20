import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import DepartmentModel from '@/models/Department';
import UserModel from '@/models/User';
import TaskModel from '@/models/Task';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';

// GET /api/departments/[id]
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  await connectDB();
  const { id } = await ctx.params;

  const department = await DepartmentModel.findById(id).select('-__v').lean();
  if (!department) {
    return NextResponse.json({ success: false, error: 'Department not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: department });
});

// PATCH /api/departments/[id]
export const PATCH = withAuth(
  async (req: NextRequest, ctx) => {
    await connectDB();
    const { id } = await ctx.params;

    const body = await req.json();
    const allowedFields = ['label', 'abbreviation', 'description', 'sequence', 'isActive'];

    const update: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        update[field] = field === 'abbreviation'
          ? String(body[field]).trim().toUpperCase()
          : field === 'label'
          ? String(body[field]).trim()
          : body[field];
      }
    }

    const updated = await DepartmentModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  },
  [UserRole.SUPER_ADMIN]
);

// DELETE /api/departments/[id]
export const DELETE = withAuth(
  async (_req: NextRequest, ctx) => {
    await connectDB();
    const { id } = await ctx.params;

    const department = await DepartmentModel.findById(id);
    if (!department) {
      return NextResponse.json({ success: false, error: 'Department not found' }, { status: 404 });
    }

    const deptName = department.name;

    // Check for users assigned to this department
    const usersInDept = await UserModel.countDocuments({ department: deptName, isActive: true });
    if (usersInDept > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete "${department.label}": ${usersInDept} active user(s) are assigned to this department. Reassign them first.`,
        },
        { status: 400 }
      );
    }

    // Check for tasks in this department
    const tasksInDept = await TaskModel.countDocuments({ department: deptName });
    if (tasksInDept > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete "${department.label}": ${tasksInDept} task(s) exist in this department.`,
        },
        { status: 400 }
      );
    }

    await DepartmentModel.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: `Department "${department.label}" has been deleted.`,
    });
  },
  [UserRole.SUPER_ADMIN]
);