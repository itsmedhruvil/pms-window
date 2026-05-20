/**
 * Seed Script — Internal Accounts Tasks Template Group
 * Run: npx ts-node --project tsconfig.scripts.json scripts/seed-internal-accounts-tasks.ts
 *
 * Creates a template group "Internal — Accounts Tasks" with all accountant tasks
 * except the last two project-based ones ("Raise Invoice for Project Milestone"
 * and "Site-wise Purchase & Expense Report for Project").
 *
 * All tasks are marked with type: 'internal' so they appear in internal tasks.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// tsconfig.scripts.json uses CommonJS — __dirname is available
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI!;
if (!MONGODB_URI) throw new Error('MONGODB_URI is required in .env');

const DEPARTMENT = {
  ACCOUNTS: 'accounts',
} as const;

const TASK_FREQUENCY = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  PROJECT: 'project',
  NEED_BASIS: 'need_basis',
  PROJECT_RECURRING: 'project_recurring',
} as const;

const templateGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '', trim: true },
    tasks: [
      {
        department: { type: String, required: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true },
        sequence: { type: Number, required: true },
        frequency: { type: String, default: TASK_FREQUENCY.PROJECT },
        type: { type: String, enum: ['project', 'internal'], default: 'project' },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const TemplateGroup =
  mongoose.models.TemplateGroup || mongoose.model('TemplateGroup', templateGroupSchema);

const ACCOUNTS_TASKS = [
  // DAILY TASKS
  {
    title: 'Daily Entries — Tally',
    description: 'Post all vouchers, receipts and payments in Tally',
    frequency: TASK_FREQUENCY.DAILY,
  },
  {
    title: 'Petty Cash Entry & Tally Cash in Hand',
    description: 'Enter petty cash, verify physical cash matches ledger',
    frequency: TASK_FREQUENCY.DAILY,
  },
  {
    title: 'Daily Allowance Report',
    description: 'Prepare and update daily allowance report for all staff',
    frequency: TASK_FREQUENCY.DAILY,
  },
  // NEED-BASIS TASKS
  {
    title: 'Create Invoices',
    description: 'Generate sales invoices for completed project milestones or deliveries',
    frequency: TASK_FREQUENCY.NEED_BASIS,
  },
  {
    title: 'Cheque Deposits',
    description: 'Deposit received cheques, update bank ledger in Tally',
    frequency: TASK_FREQUENCY.NEED_BASIS,
  },
  {
    title: 'Site-wise Purchase / Expense Report',
    description: 'Compile and send site-wise purchase/expense summary',
    frequency: TASK_FREQUENCY.NEED_BASIS,
  },
  // WEEKLY TASKS
  {
    title: 'Daily Allowance Report Review',
    description: 'Review Daily Allowance Report with Aarti Maam — every Saturday',
    frequency: TASK_FREQUENCY.WEEKLY,
  },
  {
    title: 'Pending Vendor Payment Report Review',
    description: 'Review pending vendor payment report with Aarti Maam — every Saturday',
    frequency: TASK_FREQUENCY.WEEKLY,
  },
  // MONTHLY COMPLIANCE DEADLINES
  {
    title: 'Salary Calculation',
    description: 'Calculate salaries — due 1st of month. Review with Aarti Maam.',
    frequency: TASK_FREQUENCY.MONTHLY,
  },
  {
    title: 'Submit Monthly Reports to CA',
    description: 'Submit monthly reports to CA — due 1st of month',
    frequency: TASK_FREQUENCY.MONTHLY,
  },
  {
    title: 'Monthly MIS Report Review',
    description: 'Monthly MIS report review with Taher Sir & Aarti Maam — due 2nd of month',
    frequency: TASK_FREQUENCY.MONTHLY,
  },
  {
    title: 'TDS Calculation',
    description: 'Calculate TDS — due 6th of month',
    frequency: TASK_FREQUENCY.MONTHLY,
  },
  {
    title: 'PF Calculation',
    description: 'Calculate PF — due 6th of month',
    frequency: TASK_FREQUENCY.MONTHLY,
  },
  {
    title: 'TDS Payment',
    description: 'Make TDS payment — due 7th of month',
    frequency: TASK_FREQUENCY.MONTHLY,
  },
  {
    title: 'Salary Credit Coordination with Aarti Maam',
    description: 'Coordinate salary credit with Aarti Maam — due 10th of month',
    frequency: TASK_FREQUENCY.MONTHLY,
  },
  {
    title: 'Stock Statement',
    description: 'Prepare stock statement — due 10th of month',
    frequency: TASK_FREQUENCY.MONTHLY,
  },
  {
    title: 'GST Calculation',
    description: 'Calculate GST — due 11th of month',
    frequency: TASK_FREQUENCY.MONTHLY,
  },
  {
    title: 'GST Payment',
    description: 'Make GST payment — due 14th of month',
    frequency: TASK_FREQUENCY.MONTHLY,
  },
  {
    title: 'PF Payment',
    description: 'Make PF payment — due 14th of month',
    frequency: TASK_FREQUENCY.MONTHLY,
  },
  // EXCLUDED: "Raise Invoice for Project Milestone" (PROJECT)
  // EXCLUDED: "Site-wise Purchase & Expense Report for Project" (PROJECT)
];

async function seedInternalAccountsTasks() {
  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected');

  const groupName = 'Internal — Accounts Tasks';
  const existingGroup = await TemplateGroup.findOne({ name: groupName });

  const tasks = ACCOUNTS_TASKS.map((task, idx) => ({
    department: DEPARTMENT.ACCOUNTS,
    title: task.title,
    description: task.description,
    sequence: idx,
    frequency: task.frequency,
    type: 'internal',
  }));

  if (existingGroup) {
    console.log('  ⚠️  Template group already exists, updating...');
    existingGroup.tasks = tasks;
    existingGroup.description =
      'All internal Accountant tasks (daily, weekly, monthly, need-basis) — managed as internal recurring tasks';
    await existingGroup.save();
    console.log(`  ✅ Updated template group with ${tasks.length} internal tasks`);
  } else {
    await TemplateGroup.create({
      name: groupName,
      description:
        'All internal Accountant tasks (daily, weekly, monthly, need-basis) — managed as internal recurring tasks',
      tasks,
      isActive: true,
    });
    console.log(`  ✅ Created template group "${groupName}" with ${tasks.length} internal tasks`);
  }

  console.log('─'.repeat(55));
  console.log('✅ Seed complete!');
  console.log(`  Internal tasks: ${tasks.length}`);
  const freqCounts: Record<string, number> = {};
  for (const t of tasks) {
    freqCounts[t.frequency] = (freqCounts[t.frequency] || 0) + 1;
  }
  for (const [freq, count] of Object.entries(freqCounts)) {
    console.log(`    ${freq}: ${count} tasks`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

seedInternalAccountsTasks().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});