import mongoose, { Document, Model, Schema } from 'mongoose';
import { Department, TaskStatus } from '@/types';

export interface ITaskDocument extends Document {
  projectId: mongoose.Types.ObjectId;
  department: Department;
  title: string;
  description: string;
  status: TaskStatus;
  dependencyTaskId?: mongoose.Types.ObjectId;
  assignedUser?: mongoose.Types.ObjectId;
  startDate?: Date;
  dueDate?: Date;
  completedAt?: Date;
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

// Pre-save middleware: auto-lock based on dependency
TaskSchema.pre('save', async function (next) {
  if (this.dependencyTaskId && this.isModified('dependencyTaskId')) {
    const depTask = await mongoose.model('Task').findById(this.dependencyTaskId);
    if (depTask && depTask.status !== TaskStatus.DONE) {
      this.isLocked = true;
    }
  }
  next();
});

const TaskModel: Model<ITaskDocument> =
  mongoose.models.Task || mongoose.model<ITaskDocument>('Task', TaskSchema);

export default TaskModel;
