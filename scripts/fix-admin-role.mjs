import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error('MONGODB_URI is required');

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const email = 'corp.weexalate@gmail.com';
  const user = await db.collection('users').findOne({ email: { $regex: new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } });

  if (user) {
    console.log('Found user:', user.email, '| Current role:', user.role);
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { role: 'super_admin', department: 'production' } }
    );
    console.log('✅ Updated to SUPER_ADMIN');
  } else {
    console.log('❌ User not found for email:', email);
  }

  // Show all users
  const allUsers = await db.collection('users').find({}).toArray();
  console.log('\nAll users in DB:');
  allUsers.forEach(u => console.log('  -', u.email, '| Role:', u.role, '| Dept:', u.department));

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });