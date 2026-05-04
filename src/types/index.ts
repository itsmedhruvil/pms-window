// ============================================================
// ENUMS
// ============================================================

export enum Department {
  PRODUCTION = 'production',
  PURCHASE = 'purchase',
  OPERATIONS = 'operations',
  ACCOUNTS = 'accounts',
  STORE = 'store',
  SITE = 'site',
}

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

export enum ProjectPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  DONE = 'done',
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
  HIGH = 'high',
  CRITICAL = 'critical',
}

// ============================================================
// CORE TYPES
// ============================================================

export interface WindowSpec {
  width: number;
  height: number;
  design: string;
  glassType: string;
  quantity: number;
  notes?: string;
  templateGroupId?: string;
}

export interface IUser {
  _id: string;
  clerkId: string;
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
  totalWindows: number;
  windowSpecifications: WindowSpec[];
  priority: ProjectPriority;
  deadline: Date;
  status: ProjectStatus;
  createdBy: string | IUser;
  assignedUsers: string[] | IUser[];
  activeAlertIds: string[];
  completionPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITask {
  _id: string;
  projectId: string | IProject;
  templateTaskId?: string | ITaskTemplate;
  department: Department;
  title: string;
  description: string;
  status: TaskStatus;
  dependencyTaskId?: string | ITask;
  assignedUser?: string | IUser;
  startDate?: Date;
  dueDate?: Date;
  completedAt?: Date;
  imageAttachments?: TaskImageAttachment[];
  isLocked: boolean;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaskTemplate {
  _id: string;
  department: Department;
  title: string;
  description: string;
  sequence: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskImageAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadedAt: Date;
}

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

export interface IComment {
  _id: string;
  taskId?: string;
  alertId?: string;
  content: string;
  author: string | IUser;
  mentions: string[];
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
  | { type: 'project_status_changed'; payload: { projectId: string; status: ProjectStatus } };

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

export const DEPARTMENT_LABELS: Record<Department, string> = {
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
    title: string;
    description: string;
    sequence: number;
  }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_TASKS_PER_DEPARTMENT: Record<Department, Array<{ title: string; description: string }>> = {
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
