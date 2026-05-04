import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import UserModel from '@/models/User';
import TaskModel from '@/models/Task';

const OLD_TO_NEW_DEPARTMENT_MAP: Record<string, string> = {
  'office_admin': 'production',
  'marketing': 'site',
};

async function migrateData() {
  try {
    await connectDB();
    console.log('📦 Starting database migration...\n');

    // Migrate Users
    console.log('👥 Migrating Users...');
    let updatedUsers = 0;
    for (const [oldDept, newDept] of Object.entries(OLD_TO_NEW_DEPARTMENT_MAP)) {
      const result = await UserModel.updateMany(
        { department: oldDept },
        { department: newDept }
      );
      if (result.modifiedCount > 0) {
        console.log(
          `  ✅ ${oldDept} → ${newDept}: ${result.modifiedCount} users updated`
        );
        updatedUsers += result.modifiedCount;
      }
    }
    console.log(`  📊 Total users migrated: ${updatedUsers}\n`);

    // Migrate Tasks
    console.log('📋 Migrating Tasks...');
    let updatedTasks = 0;
    for (const [oldDept, newDept] of Object.entries(OLD_TO_NEW_DEPARTMENT_MAP)) {
      const result = await TaskModel.updateMany(
        { department: oldDept },
        { department: newDept }
      );
      if (result.modifiedCount > 0) {
        console.log(
          `  ✅ ${oldDept} → ${newDept}: ${result.modifiedCount} tasks updated`
        );
        updatedTasks += result.modifiedCount;
      }
    }
    console.log(`  📊 Total tasks migrated: ${updatedTasks}\n`);

    console.log('✨ Migration completed successfully!');
    console.log(`\n📈 Summary:`);
    console.log(`  - Users updated: ${updatedUsers}`);
    console.log(`  - Tasks updated: ${updatedTasks}`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

migrateData();