import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import DepartmentModel from '@/models/Department';
import { DEPARTMENT_LABELS, DEPARTMENT_SEQUENCE } from '@/types';

// Import DEPARTMENT_ABBR from utils? It's not exported from types.
// We'll inline the abbreviations.
const DEPARTMENT_ABBR: Record<string, string> = {
  production: 'PROD',
  purchase: 'PUR',
  operations: 'OPS',
  accounts: 'ACC',
  store: 'STR',
  site: 'SITE',
};

const DEPT_DESCRIPTIONS: Record<string, string> = {
  production: 'Manufacturing and assembly of window products.',
  purchase: 'Procurement of raw materials and vendor management.',
  operations: 'Coordination and optimization of production workflows.',
  accounts: 'Financial management, invoicing, and payment tracking.',
  store: 'Inventory management, quality inspection, and dispatch.',
  site: 'On-site installation and post-installation services.',
};

async function seedDepartments() {
  try {
    await connectDB();
    console.log('🌱 Seeding departments...\n');

    // Check if departments already exist
    const existingCount = await DepartmentModel.estimatedDocumentCount();
    if (existingCount > 0) {
      console.log(`⚠️  ${existingCount} department(s) already exist. Skipping seed.\n`);

      // Show what exists
      const existing = await DepartmentModel.find().select('name label abbreviation sequence').sort({ sequence: 1 }).lean();
      console.log('Current departments:');
      existing.forEach((d) => {
        console.log(`  ${d.sequence}. ${d.name} — ${d.label} (${d.abbreviation})`);
      });
      console.log();
      return;
    }

    const departments = DEPARTMENT_SEQUENCE.map((dept, index) => ({
      name: dept,
      label: DEPARTMENT_LABELS[dept],
      abbreviation: DEPARTMENT_ABBR[dept],
      sequence: index,
      description: DEPT_DESCRIPTIONS[dept] || '',
      isActive: true,
    }));

    await DepartmentModel.insertMany(departments);

    console.log(`✅ Successfully seeded ${departments.length} departments:\n`);
    departments.forEach((d) => {
      console.log(`  ${d.sequence}. ${d.name} — ${d.label} (${d.abbreviation})`);
    });
    console.log();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedDepartments();