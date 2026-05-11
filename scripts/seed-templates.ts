/**
 * Seed Script — Task Templates from UA Master Role Task Template
 * Run: npx ts-node --project tsconfig.json scripts/seed-templates.ts
 *
 * Seeds task templates for all departments based on the Excel template:
 *   - Ram (Plant Incharge)  → Production
 *   - Santoshi (Purchase)   → Purchase
 *   - Deepa (Operations)    → Operations
 *   - Salim (Accountant)    → Accounts
 *   - Wahid (Site Supervisor) → Site
 *   - Ram (Store Incharge)  → Store
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI!;
if (!MONGODB_URI) throw new Error('MONGODB_URI is required in .env.local');

// ── Types ──────────────────────────────────────────────────────────────────────
enum Department {
  PRODUCTION = 'production',
  PURCHASE = 'purchase',
  OPERATIONS = 'operations',
  ACCOUNTS = 'accounts',
  STORE = 'store',
  SITE = 'site',
}

enum TaskFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  PROJECT = 'project',
  NEED_BASIS = 'need_basis',
  PROJECT_RECURRING = 'project_recurring',
}

// ── Schema ─────────────────────────────────────────────────────────────────────
const TaskTemplateSchema = new mongoose.Schema({
  department: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  sequence: { type: Number, required: true },
  frequency: { type: String, required: true, enum: Object.values(TaskFrequency), default: TaskFrequency.PROJECT },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

TaskTemplateSchema.index({ department: 1, sequence: 1 });

const TaskTemplate = mongoose.models.TaskTemplate || mongoose.model('TaskTemplate', TaskTemplateSchema);

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

// ── Template Data from Excel ───────────────────────────────────────────────────

interface TemplateTaskDef {
  title: string;
  description: string;
  frequency: TaskFrequency;
}

// ── RAM (PLANT INCHARGE) → PRODUCTION ──────────────────────────────────────────
const PRODUCTION_TASKS: TemplateTaskDef[] = [
  {
    title: 'Job Card Allotment',
    description: 'Receive drawing, measurements & quantity from AutoCAD / EVA Windows',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Contractor Allotment & Project Planning',
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
    frequency: TaskFrequency.NEED_BASIS,
  },
  {
    title: 'Ready for Dispatch',
    description: 'Pack all finished & QC-passed units. Confirm count. Inform Deepa that material is ready for site dispatch.',
    frequency: TaskFrequency.PROJECT,
  },
];

// ── SANTOSHI (PURCHASE) → PURCHASE ─────────────────────────────────────────────
const PURCHASE_TASKS: TemplateTaskDef[] = [
  {
    title: 'Discuss Requirements with Taher Sir — Aluminium',
    description: 'Discuss Aluminium requirements with Taher Sir',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Discuss Requirements with Taher Sir — Hardware',
    description: 'Discuss Hardware requirements with Taher Sir',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Discuss Requirements with Taher Sir — Glass',
    description: 'Discuss Glass requirements with Taher Sir',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Check Availability in Stock — Aluminium',
    description: 'Check Aluminium availability in stock',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Check Availability in Stock — Hardware',
    description: 'Check Hardware availability in stock',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Check Availability in Stock — EPDM',
    description: 'Check EPDM availability in stock',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Check Availability in Stock — Silicone',
    description: 'Check Silicone availability in stock',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Check Availability in Stock — Glass',
    description: 'Check Glass availability in stock',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Request for Quotation / PI and Check Price — Aluminium',
    description: 'Request Quotation / PI for Aluminium and check price',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Request for Quotation / PI and Check Price — Hardware',
    description: 'Request Quotation / PI for Hardware and check price',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Request for Quotation / PI and Check Price — Glass',
    description: 'Request Quotation / PI for Glass and check price',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Request for Quotation / PI and Check Price — EPDM',
    description: 'Request Quotation / PI for EPDM and check price',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Request for Quotation / PI and Check Price — Silicone',
    description: 'Request Quotation / PI for Silicone and check price',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Check Material Quantity Received — Aluminium',
    description: 'Check received quantity of Aluminium against PO',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Check Material Quantity Received — Hardware',
    description: 'Check received quantity of Hardware against PO',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Check Material Quantity Received — EPDM',
    description: 'Check received quantity of EPDM against PO',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Check Material Quantity Received — Glass',
    description: 'Check received quantity of Glass against PO',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Check Material Quantity Received — Silicone',
    description: 'Check received quantity of Silicone against PO',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Local Purchase (if required) — Hardware',
    description: 'Arrange local purchase for Hardware if required',
    frequency: TaskFrequency.NEED_BASIS,
  },
  {
    title: 'Check Material Quantity Received — Local Purchase Hardware',
    description: 'Check received quantity of locally purchased Hardware',
    frequency: TaskFrequency.NEED_BASIS,
  },
  {
    title: 'Colour Select and Quantity — Powder Coating',
    description: 'Select colour and confirm quantity for Powder Coating',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Check Material Quantity Received — Powder Coating',
    description: 'Check received quantity of Powder Coating',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Colour Select and Quantity — Anodizing',
    description: 'Select colour and confirm quantity for Anodizing',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Check Material Quantity Received — Anodizing',
    description: 'Check received quantity of Anodizing',
    frequency: TaskFrequency.PROJECT,
  },
];

// ── DEEPA (OPERATIONS) → OPERATIONS ────────────────────────────────────────────
const OPERATIONS_TASKS: TemplateTaskDef[] = [
  {
    title: 'New Project Kickoff Coordination',
    description: 'Confirm site readiness, arrange first material dispatch, brief site supervisor',
    frequency: TaskFrequency.NEED_BASIS,
  },
  {
    title: 'Daily Project Update from Ongoing Site',
    description: 'Call / message site supervisor, collect update, log in project tracker',
    frequency: TaskFrequency.PROJECT_RECURRING,
  },
  {
    title: 'Coordinating with Site Supervisor & Providing Required Materials',
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
    title: 'Vendor / Contractor Issue Escalation',
    description: 'Escalate unresolved issues to Aarti Maam or Taher Sir',
    frequency: TaskFrequency.NEED_BASIS,
  },
];

// ── SALIM (ACCOUNTANT) → ACCOUNTS ──────────────────────────────────────────────
const ACCOUNTS_TASKS: TemplateTaskDef[] = [
  // DAILY TASKS
  {
    title: 'Daily Entries — Tally',
    description: 'Post all vouchers, receipts and payments in Tally',
    frequency: TaskFrequency.DAILY,
  },
  {
    title: 'Petty Cash Entry & Tally Cash in Hand',
    description: 'Enter petty cash, verify physical cash matches ledger',
    frequency: TaskFrequency.DAILY,
  },
  {
    title: 'Daily Allowance Report',
    description: 'Prepare and update daily allowance report for all staff',
    frequency: TaskFrequency.DAILY,
  },
  // NEED-BASIS TASKS
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
    title: 'Site-wise Purchase / Expense Report',
    description: 'Compile and send site-wise purchase/expense summary',
    frequency: TaskFrequency.NEED_BASIS,
  },
  // WEEKLY TASKS
  {
    title: 'Daily Allowance Report Review',
    description: 'Review Daily Allowance Report with Aarti Maam — every Saturday',
    frequency: TaskFrequency.WEEKLY,
  },
  {
    title: 'Pending Vendor Payment Report Review',
    description: 'Review pending vendor payment report with Aarti Maam — every Saturday',
    frequency: TaskFrequency.WEEKLY,
  },
  // MONTHLY COMPLIANCE DEADLINES
  {
    title: 'Salary Calculation',
    description: 'Calculate salaries — due 1st of month. Review with Aarti Maam.',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'Submit Monthly Reports to CA',
    description: 'Submit monthly reports to CA — due 1st of month',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'Monthly MIS Report Review',
    description: 'Monthly MIS report review with Taher Sir & Aarti Maam — due 2nd of month',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'TDS Calculation',
    description: 'Calculate TDS — due 6th of month',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'PF Calculation',
    description: 'Calculate PF — due 6th of month',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'TDS Payment',
    description: 'Make TDS payment — due 7th of month',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'Salary Credit Coordination with Aarti Maam',
    description: 'Coordinate salary credit with Aarti Maam — due 10th of month',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'Stock Statement',
    description: 'Prepare stock statement — due 10th of month',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'GST Calculation',
    description: 'Calculate GST — due 11th of month',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'GST Payment',
    description: 'Make GST payment — due 14th of month',
    frequency: TaskFrequency.MONTHLY,
  },
  {
    title: 'PF Payment',
    description: 'Make PF payment — due 14th of month',
    frequency: TaskFrequency.MONTHLY,
  },
  // PROJECT-BASED TASKS
  {
    title: 'Raise Invoice for Project Milestone',
    description: 'Create and send invoice when milestone or delivery is confirmed',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Site-wise Purchase & Expense Report for Project',
    description: 'Compile all site expenses, purchases for this project and submit',
    frequency: TaskFrequency.PROJECT,
  },
];

// ── WAHID (SITE SUPERVISOR) → SITE ─────────────────────────────────────────────
const SITE_TASKS: TemplateTaskDef[] = [
  // Project-level pre-tasks
  {
    title: 'Check Qty at Plant',
    description: 'Verify all project materials are ready at plant before dispatch',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Material at Site',
    description: 'Count & inspect all materials on arrival at site',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Inform Client — Material Received',
    description: 'Confirm material received for the project (call / message)',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Site Readiness Check',
    description: 'Verify all openings / areas are ready for installation',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Contractor Briefing',
    description: 'Share drawings, measurements, installation instructions with contractor',
    frequency: TaskFrequency.PROJECT,
  },
  // Unit-wise tasks (template for each window unit)
  {
    title: 'Check Qty at Plant — Per Unit',
    description: 'Verify this unit\'s materials ready before dispatch',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Material at Site — Per Unit',
    description: 'Count & inspect unit materials on arrival',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Inform Client — Per Unit',
    description: 'Confirm material received for this unit (call / message)',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Site Readiness Check — Per Unit',
    description: 'Verify opening/area is ready for installation',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Contractor Briefing — Per Unit',
    description: 'Share drawings, measurements, instructions for unit',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Installation In Progress — Per Unit',
    description: 'Confirm contractor has started installation',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Installation Complete — Per Unit',
    description: 'Confirm installation of this unit is fully done',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'QC Check — Per Unit',
    description: 'Inspect installed unit — verify quality & alignment',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Snag / Punch List — Per Unit',
    description: 'Log any defects or pending items to fix',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Unit Sign-off & Handover — Per Unit',
    description: 'Client confirms unit installed to satisfaction',
    frequency: TaskFrequency.PROJECT,
  },
];

// ── RAM (STORE INCHARGE) → STORE ───────────────────────────────────────────────
const STORE_TASKS: TemplateTaskDef[] = [
  // DAILY TASKS
  {
    title: 'Update Stock Register',
    description: 'Enter all material movements (IN / OUT) for the day in stock register',
    frequency: TaskFrequency.DAILY,
  },
  {
    title: 'Verify Physical Stock vs Register',
    description: 'Spot-check physical stock vs register for key materials',
    frequency: TaskFrequency.DAILY,
  },
  {
    title: 'Enter Received Materials into Stock',
    description: 'Enter all materials received (verify Challan / PO match first)',
    frequency: TaskFrequency.DAILY,
  },
  {
    title: 'Coordinate with Santoshi — Pending PO / Delivery Status',
    description: 'Check pending purchase orders and expected delivery dates with Santoshi',
    frequency: TaskFrequency.DAILY,
  },
  {
    title: 'Anodizing & Coating Vendor Follow-up',
    description: 'Follow up on pending anodizing/coating batches for dispatch status',
    frequency: TaskFrequency.DAILY,
  },
  // PROJECT-BASED TASKS
  {
    title: 'Stock Availability Check vs Project BOM',
    description: 'Cross-check full BOM against store stock. Reserve available items for project.',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Raise Purchase Request to Santoshi for shortfall items',
    description: 'Identify and raise purchase requests for shortfall items as per BOM',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Aluminium — Verify Qty vs Challan / PI',
    description: 'Receive Aluminium, verify quantity against Challan / PI',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Hardware — Verify Qty vs Challan / PI',
    description: 'Receive Hardware, verify quantity against Challan / PI',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Glass — Verify Qty vs Challan / PI',
    description: 'Receive Glass, verify quantity against Challan / PI',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive EPDM — Verify Qty vs Challan / PI',
    description: 'Receive EPDM, verify quantity against Challan / PI',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Silicone — Verify Qty vs Challan / PI',
    description: 'Receive Silicone, verify quantity against Challan / PI',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Powder Coating — Verify Qty vs Challan / PI',
    description: 'Receive Powder Coating, verify quantity against Challan / PI',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Receive Anodizing — Verify Qty vs Challan / PI',
    description: 'Receive Anodizing, verify quantity against Challan / PI',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Anodizing Vendor Follow-up — Pending batch dispatch',
    description: 'Follow up with Anodizing vendor on pending batch dispatch',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Coating Vendor Follow-up — Pending batch dispatch',
    description: 'Follow up with Powder Coating vendor on pending batch dispatch',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Issue Materials to Plant Incharge against Job Card',
    description: 'Release materials to Plant Incharge against signed Job Card',
    frequency: TaskFrequency.PROJECT,
  },
  {
    title: 'Final Handover — Confirm material dispatched to site with Deepa',
    description: 'Confirm final material handover to Deepa for site dispatch',
    frequency: TaskFrequency.PROJECT,
  },
];

// ── Department mapping ─────────────────────────────────────────────────────────
const DEPARTMENT_TASKS: Record<Department, TemplateTaskDef[]> = {
  [Department.PRODUCTION]: PRODUCTION_TASKS,
  [Department.PURCHASE]: PURCHASE_TASKS,
  [Department.OPERATIONS]: OPERATIONS_TASKS,
  [Department.ACCOUNTS]: ACCOUNTS_TASKS,
  [Department.SITE]: SITE_TASKS,
  [Department.STORE]: STORE_TASKS,
};

// ── Main seed function ─────────────────────────────────────────────────────────
async function seedTemplates() {
  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected');

  // Clear existing templates
  console.log('🗑️  Clearing existing task templates...');
  await TaskTemplate.deleteMany({});
  console.log('✅ Cleared all templates');

  // Seed templates for each department
  let totalSeeded = 0;

  for (const dept of Object.values(Department)) {
    const tasks = DEPARTMENT_TASKS[dept];
    if (!tasks || tasks.length === 0) {
      console.log(`  ⚠️  No tasks defined for ${dept}, skipping`);
      continue;
    }

    const templateDocs = tasks.map((task, idx) => ({
      department: dept,
      title: task.title,
      description: task.description,
      sequence: idx,
      frequency: task.frequency,
      isActive: true,
    }));

    await TaskTemplate.insertMany(templateDocs);
    totalSeeded += templateDocs.length;
    console.log(`  ✅ ${dept}: ${templateDocs.length} templates seeded`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const totalTemplates = await TaskTemplate.countDocuments();
  const countsByDept: Record<string, number> = {};
  for (const dept of Object.values(Department)) {
    countsByDept[dept] = await TaskTemplate.countDocuments({ department: dept });
  }

  console.log('\n✅ Template seed complete!');
  console.log('─'.repeat(55));
  console.log(`  Total templates seeded: ${totalTemplates}`);
  console.log('  Breakdown by department:');
  for (const [dept, count] of Object.entries(countsByDept)) {
    const freqCounts = await TaskTemplate.aggregate([
      { $match: { department: dept } },
      { $group: { _id: '$frequency', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const freqSummary = freqCounts.map((f: { _id: string; count: number }) => `${f._id}: ${f.count}`).join(', ');
    console.log(`    ${dept.padEnd(15)} ${count} tasks (${freqSummary})`);
  }
  // ── Seed Template Group ──────────────────────────────────────────────────────
  console.log('\n📦 Creating template group from UA Master Template...');
  
  // Build all tasks with department info for the template group
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
    tasks.forEach((task, idx) => {
      // For seed ID, use a consistent ordering
      allGroupTasks.push({
        department: dept,
        title: task.title,
        description: task.description,
        sequence: allGroupTasks.length,
        frequency: task.frequency,
      });
    });
  }

  // Check if template group already exists
  const existingGroup = await TemplateGroup.findOne({ name: 'UA Master Template — Complete' });
  if (existingGroup) {
    console.log('  ⚠️  Template group already exists, updating...');
    existingGroup.tasks = allGroupTasks as any;
    existingGroup.description = 'Complete role-wise task template for all departments — seeded from UA Master Role Task Template v2';
    await existingGroup.save();
    console.log(`  ✅ Updated template group with ${allGroupTasks.length} tasks`);
  } else {
    await TemplateGroup.create({
      name: 'UA Master Template — Complete',
      description: 'Complete role-wise task template for all departments — seeded from UA Master Role Task Template v2',
      tasks: allGroupTasks,
      isActive: true,
    });
    console.log(`  ✅ Created template group with ${allGroupTasks.length} tasks`);
  }

  console.log('─'.repeat(55));

  await mongoose.disconnect();
  process.exit(0);
}

seedTemplates().catch((err) => {
  console.error('❌ Template seed failed:', err);
  process.exit(1);
});