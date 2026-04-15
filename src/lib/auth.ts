import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import UserModel from "@/models/User";
import { IUserDocument } from "@/models/User";
import { UserRole, Department } from "@/types";

export interface AuthContext {
  clerkId: string;
  user: IUserDocument;
}

type ApiHandler = (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> },
  authCtx: AuthContext,
) => Promise<NextResponse>;

/**
 * Wraps an API route with auth + DB user resolution
 */
export function withAuth(handler: ApiHandler, requiredRoles?: UserRole[]) {
  return async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
  ) => {
    try {
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 },
        );
      }

      await connectDB();
      const user = await UserModel.findOne({ clerkId: userId });

      if (!user) {
        return NextResponse.json(
          { success: false, error: "User not found in system" },
          { status: 403 },
        );
      }

      if (!user.isActive) {
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
export const MAIN_ADMIN_EMAIL = 'corp.weexalate@gmail.com';

export async function getCurrentUser(): Promise<IUserDocument | null> {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    await connectDB();
    let user = await UserModel.findOne({ clerkId: clerkUser.id });
    
    if (!user) {
      console.log(`[JIT Sync] User ${clerkUser.id} authenticated but not in DB. Creating record...`);
      
      // Fallback: Create the user immediately if the webhook hasn't fired yet
      const primaryEmail =
        clerkUser.primaryEmailAddress?.emailAddress ||
        clerkUser.emailAddresses?.[0]?.emailAddress ||
        clerkUser.externalAccounts?.[0]?.emailAddress ||
        `${clerkUser.id}@clerk.local`;
      const fullName = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim();
      const isMainAdmin = primaryEmail.toLowerCase() === MAIN_ADMIN_EMAIL;

      try {
        user = await UserModel.create({
          clerkId: clerkUser.id,
          email: primaryEmail,
          name: fullName || "New User",
          avatar: clerkUser.imageUrl,
          role: isMainAdmin ? UserRole.SUPER_ADMIN : UserRole.DEPARTMENT_USER,
          department: Department.OFFICE_ADMIN,
          isActive: true,
        });
        console.log(`[JIT Sync] Successfully created user ${user._id}`);
      } catch (createError) {
        console.error("[JIT Sync Error] Failed to create user:", createError);
        return null;
      }
    }

    if (user.email.toLowerCase() === MAIN_ADMIN_EMAIL && user.role !== UserRole.SUPER_ADMIN) {
      user.role = UserRole.SUPER_ADMIN;
      user.department = Department.OFFICE_ADMIN;
      await user.save();
    }

    return user;
  } catch (error) {
    console.error("[getCurrentUser Error]", error);
    return null;
  }
}
