/**
 * Drop the old `clerkId_1` sparse index on the `users` collection and let
 * the new partialFilterExpression index be re-created by Mongoose on next app startup.
 *
 * The old `sparse: true` index still indexed `null` values (sparse only skips
 * documents where the field *does not exist* — it does NOT skip `null`), causing
 * E11000 duplicate key errors when multiple admin-created users have no clerkId.
 *
 * Run: npx ts-node --project tsconfig.json scripts/fix-clerkid-index.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error('MONGODB_URI is required in .env.local');

async function fix() {
  await mongoose.connect(MONGODB_URI!);
  const db = mongoose.connection.db!;
  const coll = db.collection('users');

  const indexes = await coll.indexes();
  const oldIndex = indexes.find((idx: any) => idx.name === 'clerkId_1' || (idx.key && idx.key.clerkId === 1));

  if (oldIndex) {
    // Check if it has a partialFilterExpression already
    if ((oldIndex as any).partialFilterExpression) {
      console.log('✅ clerkId index already uses partialFilterExpression — nothing to do.');
    } else {
      console.log(`🗑️  Dropping old index: ${oldIndex.name}...`);
      await coll.dropIndex(oldIndex.name as string);
      console.log('✅ Old clerkId index dropped.');
      console.log('📝 The new unique index with partialFilterExpression will be created by Mongoose on next app restart.');
    }
  } else {
    console.log('No clerkId index found — the new index should be created by Mongoose on startup.');
  }

  // Show remaining indexes
  const remaining = await coll.indexes();
  console.log('\nRemaining indexes on "users":');
  remaining.forEach((idx: any) => {
    console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
    if ((idx as any).partialFilterExpression) {
      console.log(`    partialFilterExpression:`, JSON.stringify((idx as any).partialFilterExpression));
    }
    if ((idx as any).unique) {
      console.log(`    unique: true`);
    }
    if ((idx as any).sparse) {
      console.log(`    sparse: true`);
    }
  });

  await mongoose.disconnect();
}

fix().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});