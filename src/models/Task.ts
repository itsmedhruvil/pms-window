import mongoose, { Document, Model, Schema } from 'mongoose';
import { Department, TaskStatus } from '@/types';

interface TaskImageAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadedAt: Date;
}

export interface ITaskDocument extends Document {
  projectId: mongoose.Types.ObjectId;
  templateTaskId?: mongoose.Types.ObjectId;
  department: Department;
  title: string;
  description: string;
  status: TaskStatus;
  dependencyTaskId?: mongoose.Types.ObjectId;
  assignedUser?: mongoose.Types.ObjectId;
  startDate?: Date;
  dueDate?: Date;
  completedAt?: Date;
  imageAttachments?: TaskImageAttachment[];
  isLocked: boolean;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITaskDocument>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    templateTaskId: {
      type: Schema.Types.ObjectId,
      ref: 'TaskTemplate',
      default: null,
      index: true,
    },
    department: {
      type: String,
      enum: Object.values(Department),
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      required: true,
      default: TaskStatus.TODO,
    },
    dependencyTaskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    assignedUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    startDate: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    imageAttachments: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, required: true },
          url: { type: String, required: true },
          size: { type: Number, required: true },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    sequence: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes
TaskSchema.index({ projectId: 1, department: 1 });
TaskSchema.index({ projectId: 1, status: 1 });
TaskSchema.index({ assignedUser: 1, status: 1 });
TaskSchema.index({ projectId: 1, sequence: 1 });

// Pre-save middleware: auto-lock based on dependency and handle department migration
TaskSchema.pre('save', async function (next) {
  // Handle old department enum values
  const oldDepartmentMap: Record<string, Department> = {
    'office_admin': Department.PRODUCTION,
    'marketing': Department.SITE,
  };

  if (this.department && oldDepartmentMap[this.department as string]) {
    this.department = oldDepartmentMap[this.department as string];
  }

  if (this.dependencyTaskId && this.isModified('dependencyTaskId')) {
    const depTask = await mongoose.model('Task').findById(this.dependencyTaskId);
    if (depTask && depTask.status !== TaskStatus.DONE) {
      this.isLocked = true;
    }
  }
  next();
});

// Post-find middleware to handle fetched documents
TaskSchema.post('find', function (docs) {
  if (!Array.isArray(docs)) return;
  
  const oldDepartmentMap: Record<string, Department> = {
    'office_admin': Department.PRODUCTION,
    'marketing': Department.SITE,
  };

  docs.forEach((doc) => {
    if (doc.department && oldDepartmentMap[doc.department as string]) {
      doc.department = oldDepartmentMap[doc.department as string];
    }
  });
});

// Post-findOne middleware
TaskSchema.post('findOne', function (doc) {
  if (!doc) return;
  
  const oldDepartmentMap: Record<string, Department> = {
    'office_admin': Department.PRODUCTION,
    'marketing': Department.SITE,
  };

  if (doc.department && oldDepartmentMap[doc.department as string]) {
    doc.department = oldDepartmentMap[doc.department as string];
  }
});

const TaskModel: Model<ITaskDocument> =
  mongoose.models.Task || mongoose.model<ITaskDocument>('Task', TaskSchema);

export default TaskModel;
