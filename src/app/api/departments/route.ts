import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import DepartmentModel from '@/models/Department';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';

// GET /api/departments
export const GET = withAuth(async () => {
  await connectDB();

  const departments = await DepartmentModel.find()
    .select('-__v')
    .sort({ sequence: 1 })
    .lean();

  return NextResponse.json({ success: true, data: departments });
});

// POST /api/departments
export const POST = withAuth(
  async (req: NextRequest) => {
    await connectDB();

    const body = await req.json();
    const { name, label, abbreviation, description, sequence } = body;

    if (!name || !label || !abbreviation) {
      return NextResponse.json(
        { success: false, error: 'name, label, and abbreviation are required' },
        { status: 400 }
      );
    }

    const existing = await DepartmentModel.findOne({ name: name.toLowerCase().trim() });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A department with this name already exists' },
        { status: 400 }
      );
    }

    // Auto-assign sequence if not provided
    let seq = sequence;
    if (seq === undefined || seq === null) {
      const maxSeq = await DepartmentModel.findOne()
        .sort({ sequence: -1 })
        .select('sequence')
        .lean();
      seq = (maxSeq?.sequence ?? -1) + 1;
    }

    const created = await DepartmentModel.create({
      name: name.toLowerCase().trim(),
      label: label.trim(),
      abbreviation: abbreviation.trim().toUpperCase(),
      description: description || '',
      sequence: seq,
    });

    return NextResponse.json({ success: true, data: created });
  },
  [UserRole.SUPER_ADMIN]
);