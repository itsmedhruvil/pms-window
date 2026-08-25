// ============================================================
// ENUMS
// ============================================================

export const Department = {
  PRODUCTION: 'production',
  PURCHASE: 'purchase',
  OPERATIONS: 'operations',
  ACCOUNTS: 'accounts',
  STORE: 'store',
  SITE: 'site',
} as const;

export type Department = (typeof Department)[keyof typeof Department] | (string & {});

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  DEPARTMENT_USER = 'department_user',
}

export enum ProjectStatus {
  NEW = 'new',
  IN_PRODUCTION = 'in_production',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  DISPATCHED = 'dispatched',
}

export enum FactoryGroup {
  INSIDE = 'inside',
  OUTSIDE = 'outside',
}

export const FACTORY_GROUP_LABELS: Record<FactoryGroup, string> = {
  [FactoryGroup.INSIDE]: 'Inside Factory',
  [FactoryGroup.OUTSIDE]: 'Outside Factory',
};

export enum ProjectPriority {
  STANDARD = 'standard',
  NECESSARY = 'necessary',
  PRIORITY = 'priority',
  URGENT = 'urgent',
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  DONE = 'done',
}

export enum TaskFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  PROJECT = 'project',
  NEED_BASIS = 'need_basis',
  PROJECT_RECURRING = 'project_recurring',
}

export enum AlertType {
  DESIGN_CHANGE = 'design_change',
  CLIENT_ESCALATION = 'client_escalation',
  PRODUCTION_ISSUE = 'production_issue',
  MATERIAL_ISSUE = 'material_issue',
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

export enum AlertSeverity {
  LOW = 'low',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// ============================================================
// CORE TYPES
// ============================================================

export interface PdfAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadedAt: Date;
}

export interface WindowSpec {
  width: number;
  height: number;
  design: string;
  glassType: string;
  quantity: number;
  notes?: string;
  templateGroupId?: string;
  designPdf?: PdfAttachment;
}

export interface IUser {
  _id: string;
  clerkId?: string;
  email: string;
  name: string;
  role: UserRole;
  department: Department;
  avatar?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProject {
  _id: string;
  clientName: string;
  projectTitle: string;
  description?: string;
  pdfAttachments?: PdfAttachment[];
  totalWindows: number;
  windowSpecifications: WindowSpec[];
  selectedTemplateGroupId?: string;
  excelSheetName?: string;
  excelRows?: Array<Record<string, string | number | boolean | null>>;
  excelFile?: { name: string; data: string; size: number } | null;
  priority: ProjectPriority;
  startDate?: Date;
  deadline: Date;
  endDate?: Date;
  status: ProjectStatus;
  createdBy: string | IUser;
  assignedUsers: string[] | IUser[];
  activeAlertIds: string[];
  completionPercentage: number;
  address: string;
  contactPhone: string;
  budget: number;
  productTypes: string[];
  tags: string[];
  factoryGroups?: FactoryGroup[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Unified file type for task attachments.
 * Stores any uploaded asset (image, PDF, doc, etc.) with Cloudinary metadata.
 */
export interface TaskFile {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;        // MIME type (e.g. 'image/jpeg', 'application/pdf')
  publicId?: string;   // Cloudinary public ID
  uploadedAt: Date;
}

export interface ITask {
  _id: string;
  projectId?: string | IProject;
  templateTaskId?: string | ITaskTemplate;
  department: Department;
  stage?: string;
  title: string;
  description: string;
  status: TaskStatus;
  frequency: TaskFrequency;
  dependencyTaskId?: string | ITask;
  assignedUser?: string | IUser;
  startDate?: Date;
  dueDate?: Date;
  completedAt?: Date;
  /** Unified files array — replaces imageAttachments + attachments */
  files?: TaskFile[];
  /** @deprecated Use files instead */
  imageAttachments?: TaskFile[];
  /** @deprecated Use files instead */
  attachments?: TaskFile[];
  isLocked: boolean;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaskTemplate {
  _id: string;
  department: Department;
  stage?: string;
  title: string;
  description: string;
  sequence: number;
  frequency: TaskFrequency;
  isActive: boolean;
  linkedToProduct?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Retained for backward compatibility
export type TaskImageAttachment = TaskFile;
export type TaskAttachment = TaskFile;

export interface IAlert {
  _id: string;
  projectId: string | IProject;
  taskId?: string | ITask;
  type: AlertType;
  message: string;
  raisedBy: string | IUser;
  affectedDepartments: Department[];
  status: AlertStatus;
  severity: AlertSeverity;
  acknowledgedBy: string[];
  resolvedAt?: Date;
  resolvedBy?: string | IUser;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDiscussion {
  _id: string;
  projectId: string | IProject;
  title: string;
  description: string;
  startedBy: string | IUser;
  mentions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ICommentAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
}

export interface IComment {
  _id: string;
  taskId?: string;
  alertId?: string;
  discussionId?: string;
  content: string;
  author: string | IUser;
  mentions: string[];
  attachments: ICommentAttachment[];
  isSystemLog: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================
// DASHBOARD TYPES
// ============================================================

export interface DashboardMetrics {
  totalActiveProjects: number;
  projectsOnHold: number;
  taskCompletionRate: Record<Department, number>;
  avgTaskCompletionTime: number;
  alertFrequency: Record<AlertType, number>;
  bottleneckDepartment: Department | null;
}

export interface TaskTrend {
  date: string;
  completed: number;
  created: number;
}

// ============================================================
// REALTIME EVENTS
// ============================================================

export type RealtimeEvent =
  | { type: 'alert_created'; payload: IAlert }
  | { type: 'alert_updated'; payload: IAlert }
  | { type: 'task_updated'; payload: ITask }
  | { type: 'project_status_changed'; payload: { projectId: string; status: ProjectStatus } }
  | { type: 'discussion_created'; payload: IDiscussion }
  ;

// ============================================================
// WORKFLOW CONSTANTS
// ============================================================

export const DEPARTMENT_SEQUENCE: Department[] = [
  Department.PRODUCTION,
  Department.PURCHASE,
  Department.OPERATIONS,
  Department.ACCOUNTS,
  Department.STORE,
  Department.SITE,
];

export const DEPARTMENT_LABELS: Record<string, string> = {
  [Department.PRODUCTION]: 'Production',
  [Department.PURCHASE]: 'Purchase',
  [Department.OPERATIONS]: 'Operations',
  [Department.ACCOUNTS]: 'Accounts',
  [Department.STORE]: 'Store',
  [Department.SITE]: 'Site',
};

export interface ITemplateGroup {
  _id: string;
  name: string;
  description: string;
  tasks: Array<{
    department: Department;
    stage?: string;
    title: string;
    description: string;
    sequence: number;
    frequency: TaskFrequency;
    type?: 'project' | 'internal';
    linkedToProduct?: boolean;
  }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_TASKS_PER_DEPARTMENT: Record<string, Array<{ title: string; description: string }>> = {
  [Department.PRODUCTION]: [
    { title: 'Production Planning', description: 'Plan production schedule based on specifications.' },
    { title: 'Frame Assembly', description: 'Assemble window frames according to design.' },
    { title: 'Glass Installation', description: 'Install glass panels into frames.' },
    { title: 'Quality Control', description: 'Perform quality checks on assembled windows.' },
  ],
  [Department.PURCHASE]: [
    { title: 'Material Requirement Planning', description: 'Calculate raw materials needed based on window specifications.' },
    { title: 'Vendor Quotation', description: 'Get quotes from approved vendors for required materials.' },
    { title: 'Purchase Order Creation', description: 'Create and dispatch purchase orders to vendors.' },
    { title: 'Material Receipt Verification', description: 'Verify received materials against purchase orders.' },
  ],
  [Department.OPERATIONS]: [
    { title: 'Operations Coordination', description: 'Coordinate between departments for smooth workflow.' },
    { title: 'Process Optimization', description: 'Monitor and optimize production processes.' },
    { title: 'Resource Allocation', description: 'Allocate resources efficiently across projects.' },
  ],
  [Department.ACCOUNTS]: [
    { title: 'Cost Estimation', description: 'Estimate project costs and prepare quotes.' },
    { title: 'Invoice Preparation', description: 'Prepare invoices for completed work.' },
    { title: 'Payment Tracking', description: 'Track payments and outstanding balances.' },
  ],
  [Department.STORE]: [
    { title: 'Inventory Allocation', description: 'Allocate materials from inventory for this project.' },
    { title: 'Quality Inspection', description: 'Inspect all materials for quality compliance.' },
    { title: 'Production Handover', description: 'Hand over materials to production floor with documentation.' },
    { title: 'Dispatch Preparation', description: 'Package completed windows for dispatch.' },
  ],
  [Department.SITE]: [
    { title: 'Site Survey', description: 'Conduct site survey for installation requirements.' },
    { title: 'Installation Planning', description: 'Plan installation schedule and logistics.' },
    { title: 'Window Installation', description: 'Install windows at client site.' },
    { title: 'Post-Installation Check', description: 'Perform final checks after installation.' },
  ],
};
// ============================================================
// STAGES (project workflow)
// ============================================================

export const Stage = {
  PROJECT_KICKOFF: 'project_kickoff',
  MATERIAL_PURCHASE: 'material_purchase',
  MATERIAL_RECEIVED: 'material_received',
  PRODUCTION: 'production',
  SITE: 'site',
  PROJECT_CLOSURE: 'project_closure',
} as const;

export type Stage = (typeof Stage)[keyof typeof Stage] | (string & {});

export const STAGE_SEQUENCE: Stage[] = [
  Stage.PROJECT_KICKOFF,
  Stage.MATERIAL_PURCHASE,
  Stage.MATERIAL_RECEIVED,
  Stage.PRODUCTION,
  Stage.SITE,
  Stage.PROJECT_CLOSURE,
];

export const STAGE_LABELS: Record<string, string> = {
  [Stage.PROJECT_KICKOFF]: 'Project Kickoff',
  [Stage.MATERIAL_PURCHASE]: 'Material Purchase',
  [Stage.MATERIAL_RECEIVED]: 'Material Received',
  [Stage.PRODUCTION]: 'Production',
  [Stage.SITE]: 'Site',
  [Stage.PROJECT_CLOSURE]: 'Project Closure',
};

export function formatStageName(stage: string): string {
  return (
    STAGE_LABELS[stage] ||
    stage.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

/**
 * Master task categorization provided in UA_Master_Tasks_For_Windows (1).xlsx.
 * Maps each master task to its workflow stage. Used to:
 *   - populate the stage of generated tasks
 *   - resolve the stage of existing tasks in the admin project view
 *   - render the stage reference in Settings
 */
export interface StageTaskCategory {
  stage: string;
  department: string;
  title: string;
  description: string;
  frequency: string;
}

export const STAGE_TASK_CATEGORIES: StageTaskCategory[] = [
// ── Project Kickoff ─────────────────────────────────────
  { stage: Stage.PROJECT_KICKOFF, department: 'site', title: 'Site Visit (Before Project Kickoff)', description: 'Visit the site for Measurements, Status Check of the Site', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'production', title: 'Project Kick-Off Meeting', description: 'Meet with Team to Discuss about the New Project', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'operations', title: 'Project Kick-Off Meeting', description: 'Meet with Team to Discuss about the New Project', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'purchase', title: 'Discuss requirements - Aluminium', description: 'Confirm Aluminium requirements with Taher Sir', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'purchase', title: 'Discuss requirements - Hardware', description: 'Confirm Hardware requirements with Taher Sir', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'purchase', title: 'Discuss requirements - Glass', description: 'Confirm Glass requirements with Taher Sir', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'purchase', title: 'Discuss Requirements - Coating/Anodize', description: 'Confirm Coating/Anodizing requirements with Taher Sir', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'purchase', title: 'Stock Check - Aluminium', description: 'Check Aluminium stock availability', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'purchase', title: 'Stock Check - Hardware', description: 'Check Hardware stock availability', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'purchase', title: 'Stock Check - EPDM', description: 'Check EPDM stock availability', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'purchase', title: 'Stock Check - Silicone', description: 'Check Silicone stock availability', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'purchase', title: 'Stock Check - Glass', description: 'Check Glass stock availability', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'store', title: 'Stock Availability Check vs Project BOM', description: 'Check all materials against Bill of Materials', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'store', title: 'Stock Check & Update to Santoshi for Purchase', description: 'Update stock as per Project Requirement', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'store', title: 'Raise Purchase Request to Santoshi', description: 'Raise request for BOM shortfall items', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'operations', title: 'Create Job Card', description: 'Create Project Job Card', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'operations', title: 'Assign Job Card to Production', description: 'Assign Job Card to Production - Cutting List, Time of Project, etc.', frequency: 'project' },
  { stage: Stage.PROJECT_KICKOFF, department: 'production', title: 'Job Card Allotment', description: 'Receive drawing, measurements & quantity from Operations - Deepa', frequency: 'project' },
  // ── Material Purchase ───────────────────────────────────
  { stage: Stage.MATERIAL_PURCHASE, department: 'purchase', title: 'RFQ and Price Check - Aluminium', description: 'Request quotation / PO and check price', frequency: 'project' },
  { stage: Stage.MATERIAL_PURCHASE, department: 'purchase', title: 'RFQ and Price Check - Hardware', description: 'Request quotation / PO and check price', frequency: 'project' },
  { stage: Stage.MATERIAL_PURCHASE, department: 'purchase', title: 'RFQ and Price Check - Glass', description: 'Request quotation / PO and check price', frequency: 'project' },
  { stage: Stage.MATERIAL_PURCHASE, department: 'purchase', title: 'RFQ and Price Check - EPDM', description: 'Request quotation / PO and check price', frequency: 'project' },
  { stage: Stage.MATERIAL_PURCHASE, department: 'purchase', title: 'RFQ and Price Check - Silicone', description: 'Request quotation / PO and check price', frequency: 'project' },
  { stage: Stage.MATERIAL_PURCHASE, department: 'purchase', title: 'Purchase - Aluminium', description: 'Upload PO once orders placed', frequency: 'project' },
  { stage: Stage.MATERIAL_PURCHASE, department: 'purchase', title: 'Purchase - Glass', description: 'Upload PO once orders placed', frequency: 'project' },
  { stage: Stage.MATERIAL_PURCHASE, department: 'purchase', title: 'Purchase - EPDM', description: 'Upload PO once orders placed', frequency: 'project' },
  { stage: Stage.MATERIAL_PURCHASE, department: 'purchase', title: 'Purchase - Silicone', description: 'Upload PO once orders placed', frequency: 'project' },
  { stage: Stage.MATERIAL_PURCHASE, department: 'purchase', title: 'Purchase - Hardware', description: 'Upload PO once orders placed', frequency: 'project' },
  { stage: Stage.MATERIAL_PURCHASE, department: 'purchase', title: 'Local Purchase (if required) - Hardware', description: 'Purchase hardware locally if not available in stock', frequency: 'project' },
  { stage: Stage.MATERIAL_PURCHASE, department: 'purchase', title: 'Colour & Qty - Powder Coating', description: 'Confirm colour and quantity for powder coating', frequency: 'project' },
  { stage: Stage.MATERIAL_PURCHASE, department: 'purchase', title: 'Colour & Qty - Anodizing', description: 'Confirm colour and quantity for anodizing', frequency: 'project' },
// ── Material Received ───────────────────────────────────
  { stage: Stage.MATERIAL_RECEIVED, department: 'purchase', title: 'Verify Qty Received - Aluminium', description: 'Verify received quantity vs order', frequency: 'project' },
  { stage: Stage.MATERIAL_RECEIVED, department: 'purchase', title: 'Verify Qty Received - Hardware', description: 'Verify received quantity vs order', frequency: 'project' },
  { stage: Stage.MATERIAL_RECEIVED, department: 'purchase', title: 'Verify Qty Received - EPDM', description: 'Verify received quantity vs order', frequency: 'project' },
  { stage: Stage.MATERIAL_RECEIVED, department: 'purchase', title: 'Verify Qty Received - Glass', description: 'Verify received quantity vs order', frequency: 'project' },
  { stage: Stage.MATERIAL_RECEIVED, department: 'purchase', title: 'Verify Qty Received - Local Purchase Hardware', description: 'Verify received quantity vs local purchase', frequency: 'project' },
  { stage: Stage.MATERIAL_RECEIVED, department: 'purchase', title: 'Verify Qty Received - Powder Coating', description: 'Verify coating material received', frequency: 'project' },
  { stage: Stage.MATERIAL_RECEIVED, department: 'purchase', title: 'Verify Qty Received - Anodizing', description: 'Verify anodizing material received', frequency: 'project' },
  { stage: Stage.MATERIAL_RECEIVED, department: 'store', title: 'Coordinate with Santoshi - Pending PO', description: 'Check pending purchase orders and expected delivery dates with Santoshi', frequency: 'project' },
  { stage: Stage.MATERIAL_RECEIVED, department: 'store', title: 'Anodizing & Coating Followup with Santosh', description: 'Follow up on pending anodizing/coating', frequency: 'project' },
  { stage: Stage.MATERIAL_RECEIVED, department: 'store', title: 'Receive Aluminium - Verify Challan', description: 'Verify Aluminium received quantity vs Challan/PO', frequency: 'project' },
  { stage: Stage.MATERIAL_RECEIVED, department: 'store', title: 'Receive Hardware - Verify Challan', description: 'Verify Hardware received quantity vs Challan/PO', frequency: 'project' },
  { stage: Stage.MATERIAL_RECEIVED, department: 'store', title: 'Receive Glass - Verify Challan', description: 'Verify Glass received quantity vs Challan/PO', frequency: 'project' },
  { stage: Stage.MATERIAL_RECEIVED, department: 'store', title: 'Receive EPDM - Verify Challan', description: 'Verify EPDM received quantity vs Challan/PO', frequency: 'project' },
  { stage: Stage.MATERIAL_RECEIVED, department: 'store', title: 'Receive Silicone - Verify Challan', description: 'Verify Silicone received quantity vs Challan/PO', frequency: 'project' },
  { stage: Stage.MATERIAL_RECEIVED, department: 'store', title: 'Receive Powder Coating - Verify Challan', description: 'Verify Powder Coating received quantity vs Challan/PO', frequency: 'project' },
  { stage: Stage.MATERIAL_RECEIVED, department: 'store', title: 'Receive Anodizing - Verify Challan', description: 'Verify Anodizing received quantity vs Challan/PO', frequency: 'project' },
  { stage: Stage.MATERIAL_RECEIVED, department: 'store', title: 'Receive Silicone - Other Items', description: 'Verify other items received quantity vs Challan/PO', frequency: 'project' },
  // ── Production ──────────────────────────────────────────
  { stage: Stage.PRODUCTION, department: 'store', title: 'Issue Materials to Plant against Job Card', description: 'Issue all materials to plant in-charge', frequency: 'project' },
  { stage: Stage.PRODUCTION, department: 'store', title: 'Final Handover of Store', description: 'Final Handover of Store in the Project', frequency: 'project' },
  { stage: Stage.PRODUCTION, department: 'operations', title: 'Daily Project Update from Plant/Production', description: 'Take updates from Plant on Production Status', frequency: 'project' },
  { stage: Stage.PRODUCTION, department: 'operations', title: 'Dispatch of Windows', description: 'Confirm dispatches, track deliveries, update status', frequency: 'project_recurring' },
{ stage: Stage.PRODUCTION, department: 'production', title: 'Cutting', description: 'Complete cutting of profiles / sections as per Job Card measurements', frequency: 'project' },
  { stage: Stage.PRODUCTION, department: 'production', title: 'Slotting', description: 'Complete slotting work as per drawing specifications', frequency: 'project' },
  { stage: Stage.PRODUCTION, department: 'production', title: 'Assembly', description: 'Assemble all units as per drawing. Confirm count matches Job Card quantity', frequency: 'project' },
  { stage: Stage.PRODUCTION, department: 'production', title: 'QC - Quality Check', description: 'Inspect all assembled units. Check finish, dimensions & alignment. Log any rejections in Remarks.', frequency: 'project' },
  { stage: Stage.PRODUCTION, department: 'production', title: 'Rework (if applicable)', description: 'Re-process rejected units identified in QC. Re-submit for QC after rework', frequency: 'project' },
  { stage: Stage.PRODUCTION, department: 'production', title: 'Ready for Dispatch', description: 'Pack all finished & QC-passed units. Confirm count. Inform Deepa that material is ready for site dispatch.', frequency: 'project' },
  // ── Site ────────────────────────────────────────────────
  { stage: Stage.SITE, department: 'operations', title: 'Daily Project Update from Ongoing Site', description: 'Call/message site supervisor, collect update & log in project tracker', frequency: 'project' },
  { stage: Stage.SITE, department: 'site', title: 'Survey Before Dispatch From Plant (Project Level)', description: 'Verify all project materials are ready at plant before dispatch', frequency: 'project' },
  { stage: Stage.SITE, department: 'site', title: 'Receive Material at Site (Project Level)', description: 'Count & inspect all materials on arrival at site', frequency: 'project' },
  { stage: Stage.SITE, department: 'site', title: 'Inform Client (Project Level)', description: 'Confirm material received for the project via call/message', frequency: 'project' },
  { stage: Stage.SITE, department: 'site', title: 'Site Readiness Check (Project Level)', description: 'Verify all openings/areas are ready for installation', frequency: 'project' },
  { stage: Stage.SITE, department: 'site', title: 'Contractor Briefing', description: 'Share drawings, measurements, installation instructions with contractor', frequency: 'project' },
  { stage: Stage.SITE, department: 'site', title: 'Installation in Progress', description: 'Confirm contractor has started installation', frequency: 'project' },
  { stage: Stage.SITE, department: 'site', title: 'Installation Complete', description: 'Confirm installation of all units fully done', frequency: 'project' },
  { stage: Stage.SITE, department: 'site', title: 'QC Check', description: 'Inspect installed unit - verify quality & alignment', frequency: 'project' },
  // ── Project Closure ─────────────────────────────────────
  { stage: Stage.PROJECT_CLOSURE, department: 'operations', title: 'Site Closing - Material Pickup', description: 'Coordinate material collection from closed site, verify qty, arrange transport back to store', frequency: 'project' },
  { stage: Stage.PROJECT_CLOSURE, department: 'site', title: 'Unit Sign-off & Handover', description: 'Client confirms unit installed to satisfaction', frequency: 'project' },
  { stage: Stage.PROJECT_CLOSURE, department: 'site', title: 'Final Site Handover', description: 'Verify with Client and Supervisor for project completion at Site', frequency: 'project' },
  { stage: Stage.PROJECT_CLOSURE, department: 'accounts', title: 'Create Invoices', description: 'Generate sales invoices for completed project milestones or deliveries', frequency: 'project' },
  { stage: Stage.PROJECT_CLOSURE, department: 'accounts', title: 'Upload Site-wise Expense Report', description: 'Compile all site expenses and purchases for this project and submit', frequency: 'project' },
];

/**
 * Resolve the stage of a task. Uses an explicit stage when present, otherwise
 * falls back to the master task categorization (so existing tasks without a
 * stored stage still map to the correct stage).
 */
export function resolveTaskStage(task: { stage?: string; title: string }): string | undefined {
  if (task.stage) return task.stage;
  const title = task.title.toLowerCase();
  const match = STAGE_TASK_CATEGORIES.find((c) => title.includes(c.title.toLowerCase()));
  return match?.stage;
}