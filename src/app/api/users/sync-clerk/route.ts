import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import UserModel from '@/models/User';
import { withAuth } from '@/lib/auth';
import { UserRole, Department } from '@/types';

/**
 * POST /api/users/sync-clerk
 *
 * Fetches ALL users from Clerk and syncs them into the local MongoDB database.
 * - Existing users are matched by clerkId OR email and updated (name, email, avatar) 
 * - New Clerk users are created as DEPARTMENT_USER in PRODUCTION department
 * - Deleted Clerk users are left untouched (they keep their last synced state)
 * - Returns counts for created, updated, skipped, and total
 *
 * Requires SUPER_ADMIN role.
 */
export const POST = withAuth(
  async () => {
    try {
      const { clerkClient } = await import('@clerk/nextjs/server');
      await connectDB();

      const client = await clerkClient();

      // Fetch all users from Clerk (paginated)
      const allClerkUsers: Array<{
        id: string;
        emailAddresses: Array<{ id: string; emailAddress: string }>;
        primaryEmailAddressId: string | null;
        firstName: string | null;
        lastName: string | null;
        imageUrl: string;
      }> = [];
      
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const page = await client.users.getUserList({ limit, offset });
        const users = page.data;
        allClerkUsers.push(...users.map(u => ({
          id: u.id,
          emailAddresses: u.emailAddresses.map(e => ({ id: e.id, emailAddress: e.emailAddress })),
          primaryEmailAddressId: u.primaryEmailAddressId,
          firstName: u.firstName,
          lastName: u.lastName,
          imageUrl: u.imageUrl,
        })));
        
        if (users.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const clerkUser of allClerkUsers) {
        const primaryEmail =
          clerkUser.emailAddresses.find(
            (e) => e.id === clerkUser.primaryEmailAddressId,
          )?.emailAddress ||
          clerkUser.emailAddresses[0]?.emailAddress ||
          `${clerkUser.id}@clerk.local`;

        const normalizedEmail = primaryEmail.toLowerCase();
        const fullName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'New User';

        // Try to find existing user by clerkId first, then by email
        let existingUser = await UserModel.findOne({ clerkId: clerkUser.id });

        if (!existingUser) {
          existingUser = await UserModel.findOne({ email: normalizedEmail });
        }

        if (existingUser) {
          // Update existing user — merge Clerk fields without overwriting local role/department
          let changed = false;

          if (existingUser.clerkId !== clerkUser.id) {
            existingUser.clerkId = clerkUser.id;
            changed = true;
          }
          if (existingUser.email !== normalizedEmail) {
            existingUser.email = normalizedEmail;
            changed = true;
          }
          if (existingUser.name !== fullName) {
            existingUser.name = fullName;
            changed = true;
          }
          if (clerkUser.imageUrl && existingUser.avatar !== clerkUser.imageUrl) {
            existingUser.avatar = clerkUser.imageUrl;
            changed = true;
          }

          if (changed) {
            await existingUser.save();
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Create new user record
          try {
            await UserModel.create({
              clerkId: clerkUser.id,
              email: normalizedEmail,
              name: fullName,
              avatar: clerkUser.imageUrl,
              role: UserRole.DEPARTMENT_USER,
              department: Department.PRODUCTION,
              isActive: true,
            });
            created++;
          } catch (createError) {
            console.error(`[Sync Clerk] Failed to create user ${normalizedEmail}:`, createError);
            skipped++;
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          total: allClerkUsers.length,
          created,
          updated,
          skipped,
        },
        message: `Synced ${allClerkUsers.length} Clerk users. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}.`,
      });
    } catch (error) {
      console.error('[Sync Clerk Error]', error);
      return NextResponse.json(
        { success: false, error: 'Failed to sync Clerk users' },
        { status: 500 },
      );
    }
  },
  [UserRole.SUPER_ADMIN],
);