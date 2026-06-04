import { z } from 'zod';
import {
  ProjectPriority,
  ProjectStatus,
  TaskStatus,
  TaskFrequency,
  AlertType,
  AlertSeverity,
  AlertStatus,
  UserRole,
} from '@/types';

const OptionalDateSchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === '') return value;
    return value instanceof Date ? value : new Date(String(value));
  },
  z.date().nullable().optional()
);

const ProjectPrioritySchema = z.preprocess((value) => {
  if (value === 'low') return ProjectPriority.STANDARD;
  if (value === 'medium') return ProjectPriority.NECESSARY;
  if (value === 'high') return ProjectPriority.PRIORITY;
  return value;
}, z.nativeEnum(ProjectPriority));

const DepartmentSchema = z.string().trim().toLowerCase().min(1, 'Department is required');

// ============================================================
// USER SCHEMAS
// ============================================================

export const CreateUserSchema = z.object({
  clerkId: z.string().optional(),
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.nativeEnum(UserRole),
  department: DepartmentSchema,
});

export const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.nativeEnum(UserRole).optional(),
  department: DepartmentSchema.optional(),
  isActive: z.boolean().optional(),
});

// ============================================================
// PROJECT SCHEMAS
// ============================================================

const DesignPdfSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  size: z.number(),
  uploadedAt: z.string().optional(),
}).optional();

export const WindowSpecSchema = z.object({
  width: z.number().min(0).optional().default(0),
  height: z.number().min(0).optional().default(0),
  design: z.string().min(1, 'Design is required'),
  glassType: z.string().optional().default(''),
  quantity: z.number().int().positive('Quantity must be positive'),
  notes: z.string().optional(),
  templateGroupId: z.string().optional(),
  designPdf: DesignPdfSchema,
});

export const CreateProjectSchema = z.object({
  clientName: z.string().min(1, 'Client name is required').optional().or(z.literal('')),
  projectTitle: z.string().min(3, 'Project title must be at least 3 characters'),
  description: z.string().optional(),
  totalWindows: z.number().int().positive('Total windows must be positive'),
  selectedTemplateGroupId: z.string().optional(),
  windowSpecifications: z.array(WindowSpecSchema).min(1).optional(),
  priority: ProjectPrioritySchema,
  address: z.string().min(5, 'Address must be at least 5 characters'),
  contactPhone: z.string().optional(),
  productTypes: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  startDate: z.string().optional(),
  deadline: z.string()
    .refine((str) => {
      const date = new Date(str);
      if (Number.isNaN(date.valueOf())) return false;
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return date >= tomorrow;
    }, { message: 'Deadline must be a future date — please select a date from tomorrow onwards' })
    .transform((str) => new Date(str)),
  endDate: z.string().optional(),
});

export const UpdateProjectSchema = z.object({
  clientName: z.string().min(1).optional(),
  projectTitle: z.string().min(3).optional(),
  description: z.string().optional(),
  totalWindows: z.number().int().positive().optional(),
  address: z.string().min(5).optional(),
  contactPhone: z.string().optional(),
  selectedTemplateGroupId: z.string().optional(),
  windowSpecifications: z.array(WindowSpecSchema).min(1).optional(),
  excelSheetName: z.string().optional(),
  excelRows: z
    .array(z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])))
    .optional(),
  pdfAttachments: z
    .array(z.object({
      id: z.string(),
      name: z.string(),
      url: z.string(),
      size: z.number(),
      uploadedAt: z.string().optional(),
    }))
    .optional(),
  excelFile: z
    .object({
      name: z.string(),
      data: z.string(),
      size: z.number(),
    })
    .nullable()
    .optional(),
  priority: ProjectPrioritySchema.optional(),
  startDate: z.preprocess(
    (value) => {
      if (!value || value === '' || value === 'Invalid Date') return undefined;
      const d = new Date(String(value));
      return isNaN(d.getTime()) ? undefined : d;
    },
    z.date().optional()
  ).optional(),
  deadline: z.preprocess(
    (value) => {
      if (!value || value === '' || value === 'Invalid Date') return undefined;
      const d = new Date(String(value));
      return isNaN(d.getTime()) ? undefined : d;
    },
    z.date().optional()
  ).optional(),
  endDate: z.preprocess(
    (value) => {
      if (!value || value === '' || value === 'Invalid Date') return undefined;
      const d = new Date(String(value));
      return isNaN(d.getTime()) ? undefined : d;
    },
    z.date().optional()
  ).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  productTypes: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  budget: z.number().min(0).optional(),
});

// ============================================================
// TASK SCHEMAS
// ============================================================

export const CreateTaskSchema = z.object({
  title: z.string().min(3, 'Task title must be at least 3 characters'),
  description: z.string().min(10, 'Task description must be at least 10 characters'),
  projectId: z.string().optional(),
  department: DepartmentSchema,
  frequency: z.nativeEnum(TaskFrequency).optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
});

export const CreateTaskTemplateSchema = z.object({
  department: DepartmentSchema,
  title: z.string().min(3, 'Task title must be at least 3 characters'),
  description: z.string().min(10, 'Task description must be at least 10 characters'),
  sequence: z.number().int().min(0).optional(),
  frequency: z.nativeEnum(TaskFrequency).optional(),
  isActive: z.boolean().optional(),
  linkedToProduct: z.boolean().optional(),
});

export const UpdateTaskTemplateSchema = CreateTaskTemplateSchema.partial();

export const UpdateTaskSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  assignedUser: z.string().nullable().optional(),
  startDate: z
    .preprocess(
      (value) => (value instanceof Date ? value : value ? new Date(String(value)) : value),
      z.date().optional()
    )
    .optional(),
  dueDate: OptionalDateSchema,
  completedAt: OptionalDateSchema,
  description: z.string().optional(),
  imageAttachments: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(160),
        url: z.string().min(1),
        size: z.number().int().positive().max(10_000_000),
        uploadedAt: z.string().transform((str) => new Date(str)),
      })
    )
    .max(12)
    .optional(),
  attachments: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(260),
        url: z.string().min(1),
        size: z.number().int().positive().max(20_000_000),
        type: z.string().min(1),
        uploadedAt: z.string().transform((str) => new Date(str)),
      })
    )
    .max(12)
    .optional(),
});

export const TaskStatusTransitionSchema = z.object({
  status: z.nativeEnum(TaskStatus),
});

// ============================================================
// ALERT SCHEMAS
// ============================================================

export const CreateAlertSchema = z.object({
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  type: z.nativeEnum(AlertType),
  message: z.string().min(10, 'Alert message must be at least 10 characters'),
  affectedDepartments: z
    .array(DepartmentSchema)
    .min(1, 'At least one affected department required'),
  severity: z.nativeEnum(AlertSeverity),
}).refine(
  (data) => data.projectId || data.taskId,
  { message: 'Either projectId or taskId is required' }
);

export const UpdateAlertSchema = z.object({
  status: z.nativeEnum(AlertStatus).optional(),
  message: z.string().min(10).optional(),
});

export const AcknowledgeAlertSchema = z.object({
  alertId: z.string().min(1),
});

// ============================================================
// COMMENT SCHEMAS
// ============================================================

export const CreateCommentSchema = z.object({
  taskId: z.string().optional(),
  alertId: z.string().optional(),
  discussionId: z.string().optional(),
  content: z.string().min(1, 'Comment cannot be empty'),
  mentions: z.array(z.string()).optional().default([]),
  attachments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    url: z.string(),
    type: z.string(),
    size: z.number(),
    uploadedAt: z.string().optional(),
  })).optional().default([]),
}).refine(
  (data) => data.taskId || data.alertId || data.discussionId,
  { message: 'Comment must belong to a task, alert, or discussion' }
);

// ============================================================
// PAGINATION
// ============================================================

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const ProjectFiltersSchema = z.object({
  status: z.nativeEnum(ProjectStatus).optional(),
  priority: ProjectPrioritySchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
