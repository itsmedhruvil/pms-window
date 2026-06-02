import mongoose, { Document, Model, Schema } from 'mongoose';
import { Department, TaskFrequency } from '@/types';

interface ITemplateGroupTask {
  department: Department;
  title: string;
  description: string;
  sequence: number;
  frequency: TaskFrequency;
  type?: 'project' | 'internal';
  linkedToProduct?: boolean;
}

export interface ITemplateGroupDocument extends Document {
  name: string;
  description: string;
  tasks: ITemplateGroupTask[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateGroupTaskSchema = new Schema<ITemplateGroupTask>(
  {
    department: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
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
    },
    frequency: {
      type: String,
      enum: Object.values(TaskFrequency),
      default: TaskFrequency.PROJECT,
    },
    type: {
      type: String,
      enum: ['project', 'internal'],
      default: 'project',
    },
    linkedToProduct: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const TemplateGroupSchema = new Schema<ITemplateGroupDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    tasks: {
      type: [TemplateGroupTaskSchema],
      required: true,
      validate: {
        validator: (v: unknown[]) => v.length > 0,
        message: 'At least one task is required',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const TemplateGroupModel: Model<ITemplateGroupDocument> =
  mongoose.models.TemplateGroup ||
  mongoose.model<ITemplateGroupDocument>('TemplateGroup', TemplateGroupSchema);

export default TemplateGroupModel;
