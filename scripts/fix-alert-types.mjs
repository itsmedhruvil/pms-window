// Run: node scripts/fix-alert-types.mjs
// This script updates any alerts with invalid types in the database.
// Connects to MongoDB and fixes alerts with 'discussion' type.

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://corpweexalate_db_user:CKM2e5FadaZJi4BU@tasksimple.zwlxv7a.mongodb.net/?appName=tasksimple';

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const AlertModel = mongoose.model('Alert', new mongoose.Schema({}, { strict: false, collection: 'alerts' }));

  // Find all alerts with invalid types
  const invalidAlerts = await AlertModel.find({
    type: { $nin: ['design_change', 'client_escalation', 'production_issue', 'material_issue'] }
  }).lean();

  console.log(`Found ${invalidAlerts.length} alerts with invalid types:`);
  for (const alert of invalidAlerts) {
    console.log(`  - ${alert._id}: type="${alert.type}", message="${String(alert.message || '').slice(0, 50)}"`);
  }

  // Update invalid types to a valid default
  const result = await AlertModel.updateMany(
    { type: { $nin: ['design_change', 'client_escalation', 'production_issue', 'material_issue'] } },
    { $set: { type: 'design_change' } }
  );

  console.log(`\nUpdated ${result.modifiedCount} alerts with invalid types to 'design_change'`);

  await mongoose.disconnect();
  console.log('Done');
}

run().catch(console.error);