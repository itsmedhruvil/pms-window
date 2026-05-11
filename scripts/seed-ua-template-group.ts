/**
 * Seed Script — UA Master Tasks Template Group (exact from Excel)
 * Run: npx ts-node --project tsconfig.json scripts/seed-ua-template-group.ts
 *
 * Creates a template group "UA Master Tasks" with the exact tasks
 * from UA_Tasks_By_Department.xlsx across all 6 departments.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI!;
if (!MONGODB_URI) throw new Error('MONGODB_URI is required in .env.local');

// ── Constants (matching project types, avoiding enum for ESM compat) ────────────
const Department = {
  PRODUCTION: 'production',
  PURCHASE: 'purchase',
  OPERATIONS: 'operations',
  ACCOUNTS: 'accounts',
  STORE: 'store',
  SITE: 'site',
} as const;

type Department = (typeof Department)[keyof typeof Department];

const TaskFrequency = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  PROJECT: 'project',
  NEED_BASIS: 'need_basis',
  PROJECT_RECURRING: 'project_recurring',
} as const;

type TaskFrequency = (typeof TaskFrequency)[keyof typeof TaskFrequency];

// ── Schema (same as TemplateGroup model) ────────────────────────────────────────
const TemplateGroupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '', trim: true },
  tasks: [{
    department: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    sequence: { type: Number, required: true },
    frequency: { type: String, default: TaskFrequency.PROJECT },
  }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const TemplateGroup = mongoose.models.TemplateGroup || mongoose.model('TemplateGroup', TemplateGroupSchema);

// ── Task Definitions (exact from UA_Tasks_By_Department.xlsx) ───────────────────

interface TaskDef {
  title: string;
  description: string;
  frequency: TaskFrequency;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION & MANUFACTURING — Ram (Plant Incharge)
// ═══════════════════════════════════════════════════════════════════════════════
const PRODUCTION_TASKS: TaskDef[] = [
  {
    title: 'Job Card Allotment',
    description: 'Receive drawing, measurements & quantity from AutoCAD / EVA Windows',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Contractor Allotment & Planning',
    description: 'Assign workforce, set stage-wise targets & deadlines',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Material from Store',
    description: 'Collect all materials from Ram (Store). Verify qty & quality against Job Card. Raise issue if shortfall or defect.',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Cutting',
    description: 'Complete cutting of all profiles / sections as per Job Card measurements',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Slotting',
    description: 'Complete slotting work as per drawing specifications',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Assembly',
    description: 'Assemble all units as per drawing. Confirm count matches Job Card quantity.',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'QC — Quality Check',
    description: 'Inspect all assembled units. Check finish, dimensions, fitment. Log any rejections in Remarks.',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Rework (if applicable)',
    description: 'Re-process rejected units identified in QC. Re-submit for QC after rework.',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Ready for Dispatch',
    description: 'Pack all finished & QC-passed units. Confirm count. Inform Deepa that material is ready for site dispatch.',
    frequency: TaskFrequency.PROJECT,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLY CHAIN (PURCHASE) — Santoshi (Purchase)
// ═══════════════════════════════════════════════════════════════════════════════
const PURCHASE_TASKS: TaskDef[] = [
  {
    title: 'Discuss requirements — Aluminium',
    description: 'Confirm Aluminium requirements with Taher Sir',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Discuss requirements — Hardware',
    description: 'Confirm Hardware requirements with Taher Sir',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Discuss requirements — Glass',
    description: 'Confirm Glass requirements with Taher Sir',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Stock Check — Aluminium',
    description: 'Check Aluminium stock availability',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Stock Check — Hardware',
    description: 'Check Hardware stock availability',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Stock Check — EPDM',
    description: 'Check EPDM stock availability',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Stock Check — Silicone',
    description: 'Check Silicone stock availability',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Stock Check — Glass',
    description: 'Check Glass stock availability',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'RFQ and Price Check — Aluminium',
    description: 'Request quotation / PI and check price',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'RFQ and Price Check — Hardware',
    description: 'Request quotation / PI and check price',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'RFQ and Price Check — Glass',
    description: 'Request quotation / PI and check price',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'RFQ and Price Check — EPDM',
    description: 'Request quotation / PI and check price',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'RFQ and Price Check — Silicone',
    description: 'Request quotation / PI and check price',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Verify Qty Received — Aluminium',
    description: 'Verify received quantity vs order',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Verify Qty Received — Hardware',
    description: 'Verify received quantity vs order',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Verify Qty Received — EPDM',
    description: 'Verify received quantity vs order',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Verify Qty Received — Glass',
    description: 'Verify received quantity vs order',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Verify Qty Received — Silicone',
    description: 'Verify received quantity vs order',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Local Purchase (if required) — Hardware',
    description: 'Purchase hardware locally if not available in stock',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Verify Qty Received — Local Purchase Hardware',
    description: 'Verify received qty vs local purchase',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Colour & Qty — Powder Coating',
    description: 'Confirm colour and quantity for powder coating',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Verify Qty Received — Powder Coating',
    description: 'Verify coating material received',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Colour & Qty — Anodizing',
    description: 'Confirm colour and quantity for anodizing',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Verify Qty Received — Anodizing',
    description: 'Verify anodizing material received',
    frequency: TaskFrequency.PROJECT,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// OPERATIONS & LOGISTICS — Deepa (Operations Coordinator)
// ═══════════════════════════════════════════════════════════════════════════════
const OPERATIONS_TASKS: TaskDef[] = [
  {
    title: 'New Project Kickoff Coordination',
    description: 'Confirm site readiness, arrange first material dispatch, brief site supervisor',
    frequency: TaskFrequency.NEED_BASIS,
  },
  {
    title: 'Daily Project Update from Ongoing Site',
    description: 'Call/message site supervisor, collect update, log in project tracker',
    frequency: TaskFrequency.PROJECT_RECURRING,
  },
  {
    title: 'Coordinate with Site Supervisor — Materials',
    description: 'Identify material gaps, coordinate dispatch or local purchase',
    frequency: TaskFrequency.PROJECT_RECURRING,
  },
  {
    title: 'Dispatch & Logistic Coordination',
    description: 'Confirm dispatches, track deliveries, update status',
    frequency: TaskFrequency.PROJECT_RECURRING,
  },
  {
    title: 'Site Closing — Material Pickup',
    description: 'Coordinate material collection from closed site, verify qty, arrange transport back to store',
    frequency: TaskFrequency.NEED_BASIS,
  },
  {
    title: 'Vendor or Contractor Issue Escalation',
    description: 'Escalate unresolved issues to Aarti Maam or Taher Sir',
    frequency: TaskFrequency.NEED_BASIS,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCE & COMPLIANCE — Salim (Accountant)
// ═══════════════════════════════════════════════════════════════════════════════
const ACCOUNTS_TASKS: TaskDef[] = [
  // Daily
  {
    title: 'Daily Entries — Tally',
    description: 'Post all vouchers, receipts and payments in Tally',
    frequency: TaskFrequency.DAILY,
  },
  {
    title: 'Petty Cash Entry & Cash in Hand',
    description: 'Enter petty cash, verify physical cash matches ledger',
    frequency: TaskFrequency.DAILY,
  },
  {
    title: 'Daily Allowance Report',
    description: 'Prepare and update daily allowance report for all staff',
    frequency: TaskFrequency.DAILY,
  },
  // Need-basis
  {
    title: 'Create Invoices',
    description: 'Generate sales invoices for completed project milestones or deliveries',
    frequency: TaskFrequency.NEED_BASIS,
  },
  {
    title: 'Cheque Deposits',
    description: 'Deposit received cheques, update bank ledger in Tally',
    frequency: TaskFrequency.NEED_BASIS,
  },
  {
    title: 'Site-wise Purchase & Expense Report',
    description: 'Compile and send site-wise purchase/expense summary',
    frequency: TaskFrequency.NEED_BASIS,
  },
  // Weekly
  {
    title: 'Daily Allowance Report Review',
    description: 'Review with Aarti Maam',
    frequency: TaskFrequency.WEEKLY,
  },
  {
    title: 'Pending Vendor Payment Report Review',
    description: 'Review with Aarti Maam',
    frequency: TaskFrequency.WEEKLY,
  },
  // Date-specific / Monthly
  {
    title: 'Salary Calculation',
    description: 'Reviewed by Aarti Maam',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'Submit Monthly Reports to CA',
    description: 'Submit to CA',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'Monthly MIS Report Review',
    description: 'Review with Taher Sir and Aarti Maam',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'TDS Calculation',
    description: 'Internal compliance',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'PF Calculation',
    description: 'Internal compliance',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'TDS Payment',
    description: 'Internal compliance',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'Salary Credit Coordination',
    description: 'Coordinate with Aarti Maam',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'Stock Statement',
    description: 'Internal reporting',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'GST Calculation',
    description: 'Internal compliance',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'GST Payment',
    description: 'Internal compliance',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'PF Payment',
    description: 'Internal compliance',
    frequency: TaskFrequency.MONTHLY,
  },
  // Project
  {
    title: 'Raise Invoice for Project Milestone',
    description: 'Create and send invoice when milestone or delivery is confirmed',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Site-wise Expense Report for Project',
    description: 'Compile all site expenses and purchases for this project and submit',
    frequency: TaskFrequency.PROJECT,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// INSTALLATION & SITE — Wahid (Site Supervisor)
// ═══════════════════════════════════════════════════════════════════════════════
const SITE_TASKS: TaskDef[] = [
  {
    title: 'Check Qty at Plant (Project Level)',
    description: 'Verify all project materials are ready at plant before dispatch',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Material at Site (Project Level)',
    description: 'Count & inspect all materials on arrival at site',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Inform Client (Project Level)',
    description: 'Confirm material received for the project (call/message)',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Site Readiness Check (Project Level)',
    description: 'Verify all openings/areas are ready for installation',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Contractor Briefing (Project Level)',
    description: 'Share drawings, measurements, installation instructions with contractor',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Check Qty at Plant (Unit-wise)',
    description: 'Verify this unit\'s materials ready before dispatch',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Material at Site (Unit-wise)',
    description: 'Count & inspect unit materials on arrival',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Inform Client (Unit-wise)',
    description: 'Confirm material received for this unit (call/message)',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Site Readiness Check (Unit-wise)',
    description: 'Verify opening/area is ready for installation',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Contractor Briefing (Unit-wise)',
    description: 'Share drawings, measurements, instructions for unit',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Installation In Progress',
    description: 'Confirm contractor has started installation',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Installation Complete',
    description: 'Confirm installation of this unit is fully done',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'QC Check',
    description: 'Inspect installed unit — verify quality & alignment',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Snag & Punch List',
    description: 'Log any defects or pending items to fix',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Unit Sign-off & Handover',
    description: 'Client confirms unit installed to satisfaction',
    frequency: TaskFrequency.PROJECT,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// STORE & INVENTORY MANAGEMENT — Ram (Store Incharge)
// ═══════════════════════════════════════════════════════════════════════════════
const STORE_TASKS: TaskDef[] = [
  // Daily
  {
    title: 'Update Stock Register',
    description: 'Enter all material movements (IN/OUT) for the day in stock register',
    frequency: TaskFrequency.DAILY,
  },
  {
    title: 'Verify Physical Stock vs Register',
    description: 'Spot-check physical stock vs register for key materials',
    frequency: TaskFrequency.DAILY,
  },
  {
    title: 'Enter Received Materials into Stock',
    description: 'Enter all materials received (verify Challan/PO match first)',
    frequency: TaskFrequency.DAILY,
  },
  {
    title: 'Coordinate with Santoshi — Pending PO',
    description: 'Check pending purchase orders and expected delivery dates with Santoshi',
    frequency: TaskFrequency.DAILY,
  },
  {
    title: 'Anodizing & Coating Vendor Follow-up',
    description: 'Follow up on pending anodizing/coating batches for dispatch status',
    frequency: TaskFrequency.DAILY,
  },
  // Project
  {
    title: 'Stock Availability Check vs Project BOM',
    description: 'Check all materials against Bill of Materials',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Raise Purchase Request to Santoshi',
    description: 'Raise request for BOM shortfall items',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Aluminium — Verify Challan',
    description: 'Verify Aluminium received qty vs Challan/PI',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Hardware — Verify Challan',
    description: 'Verify Hardware received qty vs Challan/PI',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Glass — Verify Challan',
    description: 'Verify Glass received qty vs Challan/PI',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive EPDM — Verify Challan',
    description: 'Verify EPDM received qty vs Challan/PI',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Silicone — Verify Challan',
    description: 'Verify Silicone received qty vs Challan/PI',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Powder Coating — Verify Challan',
    description: 'Verify Powder Coating received qty vs Challan/PI',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Anodizing — Verify Challan',
    description: 'Verify Anodizing received qty vs Challan/PI',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Anodizing Vendor Follow-up — Pending batch',
    description: 'Follow up with anodizing vendor for pending batch dispatch',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Coating Vendor Follow-up — Pending batch',
    description: 'Follow up with coating vendor for pending batch dispatch',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Issue Materials to Plant against Job Card',
    description: 'Issue all materials to plant incharge',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Final Handover — Confirm Dispatch with Deepa',
    description: 'Confirm material dispatched to site with Deepa',
    frequency: TaskFrequency.PROJECT,
  },
];

// ── Department mapping ─────────────────────────────────────────────────────────
const DEPARTMENT_TASKS: Record<Department, TaskDef[]> = {
  [Department.PRODUCTION]: PRODUCTION_TASKS,
  [Department.PURCHASE]: PURCHASE_TASKS,
  [Department.OPERATIONS]: OPERATIONS_TASKS,
  [Department.ACCOUNTS]: ACCOUNTS_TASKS,
  [Department.SITE]: SITE_TASKS,
  [Department.STORE]: STORE_TASKS,
};

// ── Main seed function ─────────────────────────────────────────────────────────
async function seedUaTemplateGroup() {
  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected');

  // Build all tasks with department info in sequence
  const allGroupTasks: Array<{
    department: string;
    title: string;
    description: string;
    sequence: number;
    frequency: string;
  }> = [];

  for (const dept of Object.values(Department)) {
    const tasks = DEPARTMENT_TASKS[dept];
    if (!tasks) continue;
    tasks.forEach((task) => {
      allGroupTasks.push({
        department: dept,
        title: task.title,
        description: task.description,
        sequence: allGroupTasks.length,
        frequency: task.frequency,
      });
    });
  }

  console.log(`  📋 Total tasks to add: ${allGroupTasks.length}`);

  // Count by department for summary
  for (const dept of Object.values(Department)) {
    const count = allGroupTasks.filter((t) => t.department === dept).length;
    console.log(`     ${dept}: ${count} tasks`);
  }

  // Check if template group already exists
  const GROUP_NAME = 'UA Master Tasks';
  const existingGroup = await TemplateGroup.findOne({ name: GROUP_NAME });
  if (existingGroup) {
    console.log(`\n  ⚠️  Template group "${GROUP_NAME}" already exists, updating...`);
    existingGroup.tasks = allGroupTasks as any;
    existingGroup.description = 'Complete department-wise task template extracted from UA Master Role Task Template v2 — Production, Purchase, Operations, Finance, Site & Store';
    await existingGroup.save();
    console.log(`  ✅ Updated template group with ${allGroupTasks.length} tasks`);
  } else {
    await TemplateGroup.create({
      name: GROUP_NAME,
      description: 'Complete department-wise task template extracted from UA Master Role Task Template v2 — Production, Purchase, Operations, Finance, Site & Store',
      tasks: allGroupTasks,
      isActive: true,
    });
    console.log(`  ✅ Created template group "${GROUP_NAME}" with ${allGroupTasks.length} tasks`);
  }

  // Summary
  console.log('\n✅ Seed complete!');
  console.log('─'.repeat(55));
  console.log(`  Template Group: ${GROUP_NAME}`);
  console.log(`  Total tasks:    ${allGroupTasks.length}`);
  console.log('  Breakdown:');
  for (const dept of Object.values(Department)) {
    const count = allGroupTasks.filter((t) => t.department === dept).length;
    const freqCounts: Record<string, number> = {};
    allGroupTasks
      .filter((t) => t.department === dept)
      .forEach((t) => {
        freqCounts[t.frequency] = (freqCounts[t.frequency] || 0) + 1;
      });
    const freqSummary = Object.entries(freqCounts)
      .map(([f, c]) => `${f}: ${c}`)
      .join(', ');
    console.log(`    ${dept.padEnd(15)} ${count} tasks (${freqSummary})`);
  }
  console.log('─'.repeat(55));
  console.log('Now available in Template Groups UI for project creation.\n');

  await mongoose.disconnect();
  process.exit(0);
}

seedUaTemplateGroup().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});