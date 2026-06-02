import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import DiscussionModel from '@/models/Discussion';
import { withAuth } from '@/lib/auth';
import { UserRole } from '@/types';
import { sendPushToOneSignalUsers } from '@/lib/onesignal';

// GET /api/discussions
export const GET = withAuth(async (req: NextRequest, _ctx, { user }) => {
  await connectDB();

  const projectId = req.nextUrl.searchParams.get('projectId');
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 50, 100);

  const query: Record<string, unknown> = {};
  if (projectId) query.projectId = projectId;

  // Only show discussions where user is in the mentions array (includes starter)
  if (user.role === UserRole.DEPARTMENT_USER) {
    query.mentions = user._id;
  }

  const discussions = await DiscussionModel.find(query)
    .populate('startedBy', 'name email department')
    .populate('projectId', 'projectTitle clientName')
    .populate('mentions', 'name email department')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({ success: true, data: discussions });
});

// POST /api/discussions
export const POST = withAuth(
  async (req: NextRequest, _ctx, { user }) => {
    await connectDB();

    const body = await req.json();
    const { projectId, title, description } = body;

    if (!projectId || !title) {
      return NextResponse.json(
        { success: false, error: 'Project ID and title are required' },
        { status: 400 }
      );
    }

    // Starter is automatically added to mentions (access list)
    const discussion = await DiscussionModel.create({
      projectId,
      title,
      description: description || '',
      startedBy: user._id,
      mentions: [user._id], // starter has access
    });

    const populated = await DiscussionModel.findById(discussion._id)
      .populate('startedBy', 'name email department')
      .populate('projectId', 'projectTitle clientName')
      .populate('mentions', 'name email department')
      .lean();

    // Fire-and-forget: push notification via OneSignal to admins
    if (populated) {
      const UserModel = (await import('@/models/User')).default;
      const admins = await UserModel.find({
        role: { $in: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
        isActive: true,
      }).select('_id').lean();
      const adminIds = admins.map((a) => a._id.toString());
      if (adminIds.length > 0) {
        const projectInfo = populated.projectId && typeof populated.projectId === 'object'
          ? (populated.projectId as any).projectTitle || 'Project'
          : 'Project';
        sendPushToOneSignalUsers(
          adminIds,
          `New Discussion: ${populated.title}`,
          `${user.name} started a discussion in project "${projectInfo}".`,
          `/discussions`
        ).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DEPARTMENT_USER]
);