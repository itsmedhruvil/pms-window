import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';

export const GET = withAuth(async (_req: NextRequest, _ctx, { user }) => {
  return NextResponse.json({
    success: true,
    data: {
      role: user.role,
      department: user.department,
    },
  });
});