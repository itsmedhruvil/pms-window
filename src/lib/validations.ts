import { z } from 'zod';
import {
  Department,
  ProjectPriority,
  ProjectStatus,
  TaskStatus,
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

// ============================================================
// USER SCHEMAS
// ============================================================

export const CreateUserSchema = z.object({
  clerkId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.nativeEnum(UserRole),
  department: z.nativeEnum(Department),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.nativeEnum(UserRole).optional(),
  department: z.nativeEnum(Department).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================
// PROJECT SCHEMAS
// ============================================================

export const WindowSpecSchema = z.object({
  width: z.number().positive('Width must be positive'),
  height: z.number().positive('Height must be positive'),
  design: z.string().min(1, 'Design is required'),
  glassType: z.string().min(1, 'Glass type is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  notes: z.string().optional(),
  templateGroupId: z.string().optional(),
});

export const CreateProjectSchema = z.object({
  clientName: z.string().min(2, 'Client name must be at least 2 characters'),
  projectTitle: z.string().min(3, 'Project title must be at least 3 characters'),
  totalWindows: z.number().int().positive('Total windows must be positive'),
  windowSpecifications: z
    .array(WindowSpecSchema)
    .min(1, 'At least one window specification required'),
  priority: z.nativeEnum(ProjectPriority),
  deadline: z.string().transform((str) => new Date(str)),
});

export const UpdateProjectSchema = z.object({
  clientName: z.string().min(2).optional(),
  projectTitle: z.string().min(3).optional(),
  totalWindows: z.number().int().positive().optional(),
  windowSpecifications: z.array(WindowSpecSchema).min(1).optional(),
  priority: z.nativeEnum(ProjectPriority).optional(),
  deadline: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
});

// ============================================================
// TASK SCHEMAS
// ============================================================

export const CreateTaskSchema = z.object({
  title: z.string().min(3, 'Task title must be at least 3 characters'),
  description: z.string().min(10, 'Task description must be at least 10 characters'),
  projectId: z.string().min(1, 'Project is required'),
  department: z.nativeEnum(Department),
  dueDate: z.string().optional(),
});

export const CreateTaskTemplateSchema = z.object({
  department: z.nativeEnum(Department),
  title: z.string().min(3, 'Task title must be at least 3 characters'),
  description: z.string().min(10, 'Task description must be at least 10 characters'),
  sequence: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
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
        url: z.string().startsWith('data:image/'),
        size: z.number().int().positive().max(2_500_000),
        uploadedAt: z.string().transform((str) => new Date(str)),
      })
    )
    .max(6)
    .optional(),
});

export const TaskStatusTransitionSchema = z.object({
  status: z.nativeEnum(TaskStatus),
});

// ============================================================
// ALERT SCHEMAS
// ============================================================

export const CreateAlertSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  taskId: z.string().optional(),
  type: z.nativeEnum(AlertType),
  message: z.string().min(10, 'Alert message must be at least 10 characters'),
  affectedDepartments: z
    .array(z.nativeEnum(Department))
    .min(1, 'At least one affected department required'),
  severity: z.nativeEnum(AlertSeverity),
});

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
  content: z.string().min(1, 'Comment cannot be empty'),
  mentions: z.array(z.string()).optional().default([]),
}).refine(
  (data) => data.taskId || data.alertId,
  { message: 'Comment must belong to a task or alert' }
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
  priority: z.nativeEnum(ProjectPriority).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
