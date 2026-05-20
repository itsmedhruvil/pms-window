/**
 * Drop the old `clerkId_1` sparse index on the `users` collection.
 *
 * The old `sparse: true` index indexed `null` values (sparse only skips
 * documents where the field *does not exist* — it does NOT skip `null`),
 * causing E11000 duplicate key errors when multiple users have no clerkId.
 *
 * Run: node scripts/fix-clerkid-index.mjs
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error('MONGODB_URI is required in .env.local');

async function fix() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const coll = db.collection('users');

  const indexes = await coll.indexes();
  const oldIndex = indexes.find(
    (idx) => idx.name === 'clerkId_1' || (idx.key && idx.key.clerkId === 1)
  );

  if (oldIndex) {
    if (oldIndex.partialFilterExpression) {
      console.log('✅ clerkId index already uses partialFilterExpression — nothing to do.');
    } else {
      console.log(`🗑️  Dropping old index: ${oldIndex.name} (sparse: ${!!oldIndex.sparse})...`);
      await coll.dropIndex(oldIndex.name);
      console.log('✅ Old clerkId index dropped.');
      console.log('📝 The new unique index with partialFilterExpression will be created by Mongoose on next app restart.');
    }
  } else {
    console.log('No clerkId index found — the new index should be created by Mongoose on startup.');
  }

  // Show remaining indexes
  const remaining = await coll.indexes();
  console.log('\nRemaining indexes on "users":');
  remaining.forEach((idx) => {
    console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
    if (idx.partialFilterExpression) {
      console.log(`    partialFilterExpression:`, JSON.stringify(idx.partialFilterExpression));
    }
    if (idx.unique) console.log(`    unique: true`);
    if (idx.sparse) console.log(`    sparse: true`);
  });

  await mongoose.disconnect();
}

fix().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});