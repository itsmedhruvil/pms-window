import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import DiscussionModel from '@/models/Discussion';
import { withAuth } from '@/lib/auth';

// GET /api/discussions/[id]
export const GET = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await connectDB();
  const { id } = await params;

  const discussion = await DiscussionModel.findById(id)
    .populate('startedBy', 'name email department')
    .populate('projectId', 'projectTitle clientName')
    .populate('mentions', 'name email department')
    .lean();

  if (!discussion) {
    return NextResponse.json(
      { success: false, error: 'Discussion not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: discussion });
});