// ============================================================
// ENUMS
// ============================================================

export enum Department {
  OFFICE_ADMIN = 'office_admin',
  PURCHASE = 'purchase',
  STORE = 'store',
  MARKETING = 'marketing',
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
  department: Department;
  title: string;
  description: string;
  status: TaskStatus;
  dependencyTaskId?: string | ITask;
  assignedUser?: string | IUser;
  startDate?: Date;
  dueDate?: Date;
  completedAt?: Date;
  isLocked: boolean;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
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
  Department.OFFICE_ADMIN,
  Department.PURCHASE,
  Department.STORE,
  Department.MARKETING,
];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  [Department.OFFICE_ADMIN]: 'Office Admin',
  [Department.PURCHASE]: 'Purchase',
  [Department.STORE]: 'Store',
  [Department.MARKETING]: 'Marketing',
};

export const DEFAULT_TASKS_PER_DEPARTMENT: Record<Department, Array<{ title: string; description: string }>> = {
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
    { title: 'Design Approval (if applicable)', description: 'Get design approval from client for custom specifications.' },
    { title: 'Delivery Coordination', description: 'Coordinate delivery date and logistics with client.' },
    { title: 'Post-Delivery Follow-up', description: 'Follow up with client post-delivery for satisfaction and feedback.' },
  ],
};
