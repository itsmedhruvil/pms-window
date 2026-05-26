import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import UserModel from "@/models/User";
import { IUserDocument } from "@/models/User";
import { UserRole, Department } from "@/types";

export interface AuthContext {
  clerkId: string;
  user: IUserDocument;
}

type RouteHandlerContext = {
  params: Promise<Record<string, string>>;
};

/**
 * Wraps an API route with auth + DB user resolution
 */
export function withAuth<TContext = RouteHandlerContext>(
  handler: (
    req: NextRequest,
    context: TContext,
    authCtx: AuthContext,
  ) => Promise<NextResponse>,
  requiredRoles?: UserRole[],
) {
  return async (
    req: NextRequest,
    context: TContext,
  ) => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 },
        );
      }
      const userId = user.clerkId!;

      await connectDB();
      const dbUser = await UserModel.findOne({ clerkId: userId });

      if (!dbUser) {
        return NextResponse.json(
          { success: false, error: "User not found in system" },
          { status: 403 },
        );
      }

      if (!dbUser.isActive) {
        return NextResponse.json(
          { success: false, error: "Account is deactivated" },
          { status: 403 },
        );
      }

      if (requiredRoles && requiredRoles.length > 0) {
        if (!requiredRoles.includes(user.role)) {
          return NextResponse.json(
            { success: false, error: "Insufficient permissions" },
            { status: 403 },
          );
        }
      }

      return handler(req, context, { clerkId: userId, user });
    } catch (error) {
      console.error("[Auth Middleware Error]", error);
      return NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}

/**
 * Check if user can modify a task based on department
 */
export function canModifyTask(
  user: IUserDocument,
  taskDepartment: Department,
): boolean {
  if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN)
    return true;
  return user.department === taskDepartment;
}

/**
 * Check if user is admin or super admin
 */
export function isAdmin(user: IUserDocument): boolean {
  return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
}

/**
 * Get current user from Clerk + DB
 */
export const SUPER_ADMIN_EMAILS = [
  'corp.weexalate@gmail.com',
  'uav.acc1@gmail.com',
];

export async function getCurrentUser(): Promise<IUserDocument | null> {
  try {
    const { clerkClient, auth } = await import("@clerk/nextjs/server");
    const clerkUser = await auth();
    if (!clerkUser) return null;

    await connectDB();
    const client = await clerkClient();
    const clerkUserId = clerkUser.userId;
    if (!clerkUserId) {
      return null;
    }

    let clerkUserData;
    try {
      clerkUserData = await client.users.getUser(clerkUserId);
    } catch (clerkErr) {
      console.error(`[Auth] Clerk API fetch failed for ${clerkUserId}, falling back to DB user:`, clerkErr);

      // Try to find the user from the MongoDB record using clerkId
      const dbUser = await UserModel.findOne({ clerkId: clerkUserId }).lean();
      if (dbUser) return dbUser as unknown as IUserDocument;

      // No DB fallback — user can't be resolved
      return null;
    }

    const primaryEmail =
      clerkUserData.emailAddresses.find(
        (email) => email.id === clerkUserData.primaryEmailAddressId,
      )?.emailAddress ||
      clerkUserData.emailAddresses[0]?.emailAddress ||
      clerkUserData.externalAccounts[0]?.emailAddress ||
      `${clerkUserData.id}@clerk.local`;
    const normalizedEmail = primaryEmail.toLowerCase();
    const fullName = `${clerkUserData.firstName || ""} ${clerkUserData.lastName || ""}`.trim();
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(normalizedEmail);

    let user = await UserModel.findOne({
      $or: [{ clerkId: clerkUserData.id }, { email: normalizedEmail }],
    });

    if (!user) {
      console.log(`[JIT Sync] User ${clerkUserData.id} authenticated but not in DB. Creating record...`);

      try {
        user = await UserModel.create({
          clerkId: clerkUserData.id,
          email: normalizedEmail,
          name: fullName || "New User",
          avatar: clerkUserData.imageUrl,
          role: isSuperAdmin ? UserRole.SUPER_ADMIN : UserRole.DEPARTMENT_USER,
          department: Department.PRODUCTION,
          isActive: true,
        });
        console.log(`[JIT Sync] Successfully created user ${user._id}`);
      } catch (createError) {
        console.error("[JIT Sync Error] Failed to create user:", createError);
        user = await UserModel.findOne({ email: normalizedEmail });
        if (!user) return null;
      }
    }

    let shouldSave = false;
    if (user.clerkId !== clerkUserData.id) {
      user.clerkId = clerkUserData.id;
      shouldSave = true;
    }
    if (clerkUserData.imageUrl && user.avatar !== clerkUserData.imageUrl) {
      user.avatar = clerkUserData.imageUrl;
      shouldSave = true;
    }

    // Force super admin role if email matches — always enforce on every login
    if (SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      if (user.role !== UserRole.SUPER_ADMIN) {
        user.role = UserRole.SUPER_ADMIN;
        shouldSave = true;
      }
      if (user.department !== Department.PRODUCTION) {
        user.department = Department.PRODUCTION;
        shouldSave = true;
      }
    }

    if (shouldSave) await user.save();

    // Always sync role and department to Clerk's publicMetadata so the
    // client-side useUser() hook reads the correct values.
    // Reuse the already-fetched clerkUserData to avoid a redundant API call.
    try {
      const currentMeta = clerkUserData.publicMetadata || {};

      if (
        currentMeta.role !== user.role ||
        currentMeta.department !== user.department
      ) {
        console.log(`[Auth] Syncing Clerk metadata for ${user.email}: role=${user.role}, dept=${user.department}`);
        const client = await clerkClient();
        await client.users.updateUser(clerkUserId, {
          publicMetadata: {
            ...currentMeta,
            role: user.role,
            department: user.department,
          },
        });
      }
    } catch (metaError) {
      // Non-critical — metadata sync is best-effort
      console.warn('[Auth] Failed to sync Clerk metadata:', metaError);
    }

    return user;
  } catch (error) {
    console.error("[getCurrentUser Error]", error);
    return null;
  }
}
