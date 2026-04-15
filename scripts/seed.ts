/**
 * Seed Script — Window Manufacturing ERP
 * Run: npx ts-node --project tsconfig.json scripts/seed.ts
 *
 * Creates: 4 users (one per dept), 3 sample projects, full task chains,
 * 2 sample alerts, and comment threads.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// ── Inline model imports (avoids Next.js module resolution at runtime) ────────
const MONGODB_URI = process.env.MONGODB_URI!;
if (!MONGODB_URI) throw new Error('MONGODB_URI is required in .env.local');

// ── Types ──────────────────────────────────────────────────────────────────────
enum Department { OFFICE_ADMIN = 'office_admin', PURCHASE = 'purchase', STORE = 'store', MARKETING = 'marketing' }
enum UserRole { SUPER_ADMIN = 'super_admin', ADMIN = 'admin', DEPARTMENT_USER = 'department_user' }
enum ProjectStatus { NEW = 'new', IN_PRODUCTION = 'in_production', ON_HOLD = 'on_hold', COMPLETED = 'completed', DISPATCHED = 'dispatched' }
enum ProjectPriority { LOW = 'low', MEDIUM = 'medium', HIGH = 'high', URGENT = 'urgent' }
enum TaskStatus { TODO = 'todo', IN_PROGRESS = 'in_progress', BLOCKED = 'blocked', DONE = 'done' }
enum AlertType { DESIGN_CHANGE = 'design_change', CLIENT_ESCALATION = 'client_escalation', PRODUCTION_ISSUE = 'production_issue', MATERIAL_ISSUE = 'material_issue' }
enum AlertStatus { ACTIVE = 'active', ACKNOWLEDGED = 'acknowledged', RESOLVED = 'resolved' }
enum AlertSeverity { HIGH = 'high', CRITICAL = 'critical' }

const DEPARTMENT_SEQUENCE = [Department.OFFICE_ADMIN, Department.PURCHASE, Department.STORE, Department.MARKETING];

const DEFAULT_TASKS: Record<Department, Array<{ title: string; description: string }>> = {
  [Department.OFFICE_ADMIN]: [
    { title: 'Order Intake & Verification', description: 'Verify client order details, specifications, and confirm requirements.' },
    { title: 'Client Documentation', description: 'Prepare and send order confirmation, contracts, and specs to client.' },
    { title: 'Production Briefing', description: 'Brief production team with final approved specifications.' },
  ],
  [Department.PURCHASE]: [
    { title: 'Material Requirement Planning', description: 'Calculate raw materials needed based on window specifications.' },
    { title: 'Vendor Quotation', description: 'Get quotes from approved vendors for required materials.' },
    { title: 'Purchase Order Creation', description: 'Create and dispatch purchase orders to vendors.' },
    { title: 'Material Receipt Verification', description: 'Verify received materials against purchase orders.' },
  ],
  [Department.STORE]: [
    { title: 'Inventory Allocation', description: 'Allocate materials from inventory for this project.' },
    { title: 'Quality Inspection', description: 'Inspect all materials for quality compliance.' },
    { title: 'Production Handover', description: 'Hand over materials to production floor with documentation.' },
    { title: 'Dispatch Preparation', description: 'Package completed windows for dispatch.' },
  ],
  [Department.MARKETING]: [
    { title: 'Client Communication Update', description: 'Send progress update to client with timeline.' },
    { title: 'Design Approval', description: 'Get design approval from client for custom specifications.' },
    { title: 'Delivery Coordination', description: 'Coordinate delivery date and logistics with client.' },
    { title: 'Post-Delivery Follow-up', description: 'Follow up with client post-delivery for satisfaction and feedback.' },
  ],
};

// ── Schema definitions ─────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, enum: Object.values(UserRole), required: true },
  department: { type: String, enum: Object.values(Department), required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const ProjectSchema = new mongoose.Schema({
  clientName: String,
  projectTitle: String,
  totalWindows: Number,
  windowSpecifications: [{ width: Number, height: Number, design: String, glassType: String, quantity: Number, notes: String }],
  priority: String,
  deadline: Date,
  status: { type: String, default: ProjectStatus.NEW },
  createdBy: mongoose.Schema.Types.ObjectId,
  assignedUsers: [mongoose.Schema.Types.ObjectId],
  activeAlertIds: [mongoose.Schema.Types.ObjectId],
  completionPercentage: { type: Number, default: 0 },
}, { timestamps: true });

const TaskSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, required: true },
  department: String,
  title: String,
  description: String,
  status: { type: String, default: TaskStatus.TODO },
  dependencyTaskId: mongoose.Schema.Types.ObjectId,
  assignedUser: mongoose.Schema.Types.ObjectId,
  startDate: Date,
  dueDate: Date,
  completedAt: Date,
  isLocked: { type: Boolean, default: false },
  sequence: Number,
}, { timestamps: true });

const AlertSchema = new mongoose.Schema({
  projectId: mongoose.Schema.Types.ObjectId,
  taskId: mongoose.Schema.Types.ObjectId,
  type: String,
  message: String,
  raisedBy: mongoose.Schema.Types.ObjectId,
  affectedDepartments: [String],
  status: { type: String, default: AlertStatus.ACTIVE },
  severity: String,
  acknowledgedBy: [mongoose.Schema.Types.ObjectId],
  resolvedAt: Date,
  resolvedBy: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

const CommentSchema = new mongoose.Schema({
  taskId: mongoose.Schema.Types.ObjectId,
  alertId: mongoose.Schema.Types.ObjectId,
  content: String,
  author: mongoose.Schema.Types.ObjectId,
  mentions: [mongoose.Schema.Types.ObjectId],
  isSystemLog: { type: Boolean, default: false },
}, { timestamps: true });

// ── Models ─────────────────────────────────────────────────────────────────────
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);
const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);
const Alert = mongoose.models.Alert || mongoose.model('Alert', AlertSchema);
const Comment = mongoose.models.Comment || mongoose.model('Comment', CommentSchema);

// ── Helpers ────────────────────────────────────────────────────────────────────
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function generateTasks(
  projectId: mongoose.Types.ObjectId,
  adminUserId: mongoose.Types.ObjectId,
  partialProgress: 'none' | 'office_done' | 'halfway' = 'none'
) {
  const tasks: mongoose.Document[] = [];
  let seq = 0;
  let prevDeptLastId: mongoose.Types.ObjectId | null = null;

  for (const dept of DEPARTMENT_SEQUENCE) {
    const deptTaskDefs = DEFAULT_TASKS[dept];
    let prevIdInDept: mongoose.Types.ObjectId | null = null;

    for (let i = 0; i < deptTaskDefs.length; i++) {
      const taskId = new mongoose.Types.ObjectId();
      const depId = i === 0 ? prevDeptLastId : prevIdInDept;
      const isLocked = depId !== null;

      // Determine status based on progress scenario
      let status = TaskStatus.TODO;
      if (partialProgress === 'office_done' && dept === Department.OFFICE_ADMIN) {
        status = TaskStatus.DONE;
      }
      if (partialProgress === 'halfway') {
        if (dept === Department.OFFICE_ADMIN) status = TaskStatus.DONE;
        if (dept === Department.PURCHASE && i < 2) status = TaskStatus.DONE;
        if (dept === Department.PURCHASE && i === 2) status = TaskStatus.IN_PROGRESS;
      }

      const task = new Task({
        _id: taskId,
        projectId,
        department: dept,
        title: deptTaskDefs[i].title,
        description: deptTaskDefs[i].description,
        status,
        dependencyTaskId: depId || undefined,
        isLocked: isLocked && status === TaskStatus.TODO,
        sequence: seq++,
        ...(status === TaskStatus.DONE && { completedAt: daysAgo(Math.floor(Math.random() * 5)) }),
        ...(status === TaskStatus.IN_PROGRESS && { startDate: daysAgo(1) }),
      });

      tasks.push(task);
      prevIdInDept = taskId;
    }

    prevDeptLastId = prevIdInDept;
  }

  await Task.insertMany(tasks);

  // Unlock first dept tasks
  await Task.updateMany(
    { projectId, department: Department.OFFICE_ADMIN, isLocked: true },
    { $set: { isLocked: false } }
  );

  // System log
  await Comment.create({
    content: `Project workflow initialized. ${tasks.length} tasks generated across 4 departments.`,
    author: adminUserId,
    taskId: (tasks[0] as any)._id,
    isSystemLog: true,
  });

  // Compute completion
  const done = tasks.filter(t => (t as any).status === TaskStatus.DONE).length;
  const pct = Math.round((done / tasks.length) * 100);
  await Project.findByIdAndUpdate(projectId, { completionPercentage: pct });

  return tasks;
}

// ── Main seed function ─────────────────────────────────────────────────────────
async function seed() {
  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected');

  // Clear existing data
  console.log('🗑️  Clearing existing seed data...');
  await Promise.all([
    User.deleteMany({ clerkId: { $regex: /^seed_/ } }),
    Project.deleteMany({ clientName: { $regex: /^SEED_/ } }),
  ]);

  // Find projects to clean tasks/alerts/comments
  const seedProjects = await Project.find({ clientName: { $regex: /^SEED_/ } });
  if (seedProjects.length > 0) {
    const ids = seedProjects.map(p => p._id);
    await Task.deleteMany({ projectId: { $in: ids } });
    await Alert.deleteMany({ projectId: { $in: ids } });
  }

  // ── Create Users ─────────────────────────────────────────────────────────────
  console.log('👤 Creating users...');
  const adminUser = await User.create({
    clerkId: 'seed_admin_001',
    email: 'admin@windowerp.dev',
    name: 'Rahul Mehta',
    role: UserRole.ADMIN,
    department: Department.OFFICE_ADMIN,
    isActive: true,
  });

  const officeUser = await User.create({
    clerkId: 'seed_office_001',
    email: 'office@windowerp.dev',
    name: 'Priya Sharma',
    role: UserRole.DEPARTMENT_USER,
    department: Department.OFFICE_ADMIN,
    isActive: true,
  });

  const purchaseUser = await User.create({
    clerkId: 'seed_purchase_001',
    email: 'purchase@windowerp.dev',
    name: 'Arjun Patel',
    role: UserRole.DEPARTMENT_USER,
    department: Department.PURCHASE,
    isActive: true,
  });

  const storeUser = await User.create({
    clerkId: 'seed_store_001',
    email: 'store@windowerp.dev',
    name: 'Kavya Nair',
    role: UserRole.DEPARTMENT_USER,
    department: Department.STORE,
    isActive: true,
  });

  const marketingUser = await User.create({
    clerkId: 'seed_marketing_001',
    email: 'marketing@windowerp.dev',
    name: 'Rohan Desai',
    role: UserRole.DEPARTMENT_USER,
    department: Department.MARKETING,
    isActive: true,
  });

  console.log(`  ✅ Created 5 users`);

  // ── Project 1: New order, just started ───────────────────────────────────────
  console.log('📁 Creating Project 1: Sharma Residency (urgent, new)...');
  const project1 = await Project.create({
    clientName: 'SEED_Sharma Residencies Pvt Ltd',
    projectTitle: '4BHK Villa Block-C — Full Window Package',
    totalWindows: 28,
    windowSpecifications: [
      { width: 1800, height: 1200, design: 'Casement', glassType: 'Double Glazed', quantity: 12, notes: 'Master bedroom & living area' },
      { width: 1200, height: 900, design: 'Sliding', glassType: 'Tinted', quantity: 10, notes: 'Bedrooms' },
      { width: 600, height: 600, design: 'Fixed', glassType: 'Frosted', quantity: 6, notes: 'Bathrooms' },
    ],
    priority: ProjectPriority.URGENT,
    deadline: daysFromNow(12),
    status: ProjectStatus.IN_PRODUCTION,
    createdBy: adminUser._id,
    assignedUsers: [officeUser._id, purchaseUser._id, storeUser._id, marketingUser._id],
    activeAlertIds: [],
    completionPercentage: 0,
  });

  await generateTasks(project1._id, adminUser._id, 'none');
  console.log(`  ✅ Project 1 created`);

  // ── Project 2: In progress, halfway through ───────────────────────────────────
  console.log('📁 Creating Project 2: Greenfield Towers (high, in-progress)...');
  const project2 = await Project.create({
    clientName: 'SEED_Greenfield Infrastructure Ltd',
    projectTitle: 'Commercial Tower Block-A — Floor 4 to 8 Windows',
    totalWindows: 64,
    windowSpecifications: [
      { width: 2400, height: 1500, design: 'Fixed', glassType: 'Low-E', quantity: 40, notes: 'South-facing facade — heat resistant required' },
      { width: 1200, height: 1200, design: 'Tilt & Turn', glassType: 'Tempered', quantity: 24, notes: 'Emergency egress windows' },
    ],
    priority: ProjectPriority.HIGH,
    deadline: daysFromNow(21),
    status: ProjectStatus.IN_PRODUCTION,
    createdBy: adminUser._id,
    assignedUsers: [officeUser._id, purchaseUser._id, storeUser._id, marketingUser._id],
    activeAlertIds: [],
    completionPercentage: 0,
  });

  const p2Tasks = await generateTasks(project2._id, adminUser._id, 'halfway');

  // Assign some tasks
  await Task.updateOne(
    { projectId: project2._id, department: Department.PURCHASE, sequence: { $gte: 3 } },
    { $set: { assignedUser: purchaseUser._id } }
  );
  console.log(`  ✅ Project 2 created`);

  // ── Project 3: On hold due to alert ─────────────────────────────────────────
  console.log('📁 Creating Project 3: Rajput Bungalows (on hold with alert)...');
  const project3 = await Project.create({
    clientName: 'SEED_Rajput Construction Co',
    projectTitle: '3BHK Bungalow Plot-7 — Bay & Casement Package',
    totalWindows: 18,
    windowSpecifications: [
      { width: 3600, height: 1200, design: 'Bay', glassType: 'Clear Float', quantity: 4, notes: 'Living room bay windows — requires structural support' },
      { width: 1200, height: 1200, design: 'Casement', glassType: 'Laminated', quantity: 14, notes: 'Standard openings' },
    ],
    priority: ProjectPriority.MEDIUM,
    deadline: daysFromNow(30),
    status: ProjectStatus.ON_HOLD,
    createdBy: adminUser._id,
    assignedUsers: [officeUser._id, purchaseUser._id, storeUser._id, marketingUser._id],
    activeAlertIds: [],
    completionPercentage: 0,
  });

  await generateTasks(project3._id, adminUser._id, 'office_done');

  // Create active alert for project 3
  const alert1 = await Alert.create({
    projectId: project3._id,
    type: AlertType.DESIGN_CHANGE,
    message: 'Client has requested a change to the bay window design. Original specification called for 3600mm width but client now wants two separate 1800mm units side-by-side with a centre mullion. This affects structural requirements, glass procurement, and installation. Awaiting revised structural report from architect before proceeding.',
    raisedBy: adminUser._id,
    affectedDepartments: [Department.OFFICE_ADMIN, Department.PURCHASE, Department.STORE],
    status: AlertStatus.ACTIVE,
    severity: AlertSeverity.HIGH,
    acknowledgedBy: [],
  });

  // Update project with active alert
  await Project.findByIdAndUpdate(project3._id, {
    $push: { activeAlertIds: alert1._id },
  });

  // Block affected tasks
  await Task.updateMany(
    {
      projectId: project3._id,
      department: { $in: [Department.PURCHASE, Department.STORE] },
    },
    { $set: { status: TaskStatus.BLOCKED } }
  );

  // Add comment thread to alert
  await Comment.create({
    alertId: alert1._id,
    content: `Alert raised: Design change for bay windows. Client requested modification from 3600mm single unit to two 1800mm units. All purchase and store tasks blocked pending resolution.`,
    author: adminUser._id,
    isSystemLog: true,
  });

  await Comment.create({
    alertId: alert1._id,
    content: `@Arjun Patel please hold all material procurement for the bay window section. We need to wait for the revised structural drawing from the architect. Estimated 3 business days.`,
    author: adminUser._id,
    mentions: [purchaseUser._id],
    isSystemLog: false,
  });

  await Comment.create({
    alertId: alert1._id,
    content: `Understood, Rahul. I've already put the 3600mm frame order on hold with the supplier. They can accommodate the change if we confirm within 5 days. Should I request pricing for the 1800mm alternative in parallel?`,
    author: purchaseUser._id,
    mentions: [],
    isSystemLog: false,
  });

  console.log(`  ✅ Project 3 created with active alert`);

  // ── Project 4: Completed ─────────────────────────────────────────────────────
  console.log('📁 Creating Project 4: Verma Apartments (completed)...');
  const project4 = await Project.create({
    clientName: 'SEED_Verma Builders & Associates',
    projectTitle: 'Skyview Apartments Tower-2 — Balcony Sliding Units',
    totalWindows: 45,
    windowSpecifications: [
      { width: 2100, height: 2100, design: 'Sliding', glassType: 'Tempered', quantity: 30, notes: 'Full-height balcony sliding doors' },
      { width: 900, height: 600, design: 'Fixed', glassType: 'Clear Float', quantity: 15, notes: 'Transom windows above sliding doors' },
    ],
    priority: ProjectPriority.MEDIUM,
    deadline: daysAgo(5),
    status: ProjectStatus.COMPLETED,
    createdBy: adminUser._id,
    assignedUsers: [officeUser._id, purchaseUser._id, storeUser._id, marketingUser._id],
    activeAlertIds: [],
    completionPercentage: 100,
  });

  // Create all tasks as DONE for project 4
  let p4Seq = 0;
  let p4PrevDeptId: mongoose.Types.ObjectId | null = null;
  const p4Tasks: any[] = [];

  for (const dept of DEPARTMENT_SEQUENCE) {
    const deptDefs = DEFAULT_TASKS[dept];
    let prevId: mongoose.Types.ObjectId | null = null;

    for (let i = 0; i < deptDefs.length; i++) {
      const tid = new mongoose.Types.ObjectId();
      const depId = i === 0 ? p4PrevDeptId : prevId;
      const startDate = daysAgo(25 - p4Seq);
      const completedAt = new Date(startDate.getTime() + 2 * 60 * 60 * 1000 * (1 + Math.random() * 3));

      p4Tasks.push({
        _id: tid,
        projectId: project4._id,
        department: dept,
        title: deptDefs[i].title,
        description: deptDefs[i].description,
        status: TaskStatus.DONE,
        dependencyTaskId: depId || undefined,
        isLocked: false,
        sequence: p4Seq++,
        startDate,
        completedAt,
      });

      prevId = tid;
    }
    p4PrevDeptId = prevId;
  }

  await Task.insertMany(p4Tasks);

  // Add system log
  await Comment.create({
    content: `Project "${project4.projectTitle}" completed. All 14 tasks done. Ready for dispatch.`,
    author: adminUser._id,
    taskId: p4Tasks[0]._id,
    isSystemLog: true,
  });

  console.log(`  ✅ Project 4 created (completed)`);

  // ── Summary ──────────────────────────────────────────────────────────────────
  const totalTasks = await Task.countDocuments();
  const totalAlerts = await Alert.countDocuments();
  const totalComments = await Comment.countDocuments();

  console.log('\n✅ Seed complete!');
  console.log('─'.repeat(50));
  console.log(`  Users:    5`);
  console.log(`  Projects: 4`);
  console.log(`  Tasks:    ${totalTasks}`);
  console.log(`  Alerts:   ${totalAlerts}`);
  console.log(`  Comments: ${totalComments}`);
  console.log('─'.repeat(50));
  console.log('\nSeed credentials (use with Clerk):');
  console.log('  admin@windowerp.dev        → Admin');
  console.log('  office@windowerp.dev       → Office Admin dept');
  console.log('  purchase@windowerp.dev     → Purchase dept');
  console.log('  store@windowerp.dev        → Store dept');
  console.log('  marketing@windowerp.dev    → Marketing dept');
  console.log('\nNote: Clerk users must be created separately in your Clerk dashboard.');
  console.log('After creating Clerk users, update their clerkId in MongoDB or re-run');
  console.log('through the /api/webhooks/clerk endpoint.\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
