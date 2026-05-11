import mongoose, { Document, Model, Schema } from 'mongoose';
import { Department, TaskFrequency } from '@/types';

export interface ITaskTemplateDocument extends Document {
  department: Department;
  title: string;
  description: string;
  sequence: number;
  frequency: TaskFrequency;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TaskTemplateSchema = new Schema<ITaskTemplateDocument>(
  {
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
    sequence: {
      type: Number,
      required: true,
      index: true,
    },
    frequency: {
      type: String,
      enum: Object.values(TaskFrequency),
      required: true,
      default: TaskFrequency.PROJECT,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

TaskTemplateSchema.index({ department: 1, sequence: 1 });

const TaskTemplateModel: Model<ITaskTemplateDocument> =
  mongoose.models.TaskTemplate ||
  mongoose.model<ITaskTemplateDocument>('TaskTemplate', TaskTemplateSchema);

export default TaskTemplateModel;
