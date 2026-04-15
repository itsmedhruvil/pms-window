import mongoose, { Document, Model, Schema } from 'mongoose';
import { ProjectStatus, ProjectPriority } from '@/types';

const WindowSpecSchema = new Schema(
  {
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    design: { type: String, required: true, trim: true },
    glassType: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    notes: { type: String, trim: true },
  },
  { _id: true }
);

export interface IProjectDocument extends Document {
  clientName: string;
  projectTitle: string;
  totalWindows: number;
  windowSpecifications: typeof WindowSpecSchema[];
  priority: ProjectPriority;
  deadline: Date;
  status: ProjectStatus;
  createdBy: mongoose.Types.ObjectId;
  assignedUsers: mongoose.Types.ObjectId[];
  activeAlertIds: mongoose.Types.ObjectId[];
  completionPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProjectDocument>(
  {
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    projectTitle: {
      type: String,
      required: true,
      trim: true,
    },
    totalWindows: {
      type: Number,
      required: true,
      min: 1,
    },
    windowSpecifications: {
      type: [WindowSpecSchema],
      required: true,
      validate: {
        validator: (v: unknown[]) => v.length > 0,
        message: 'At least one window specification is required',
      },
    },
    priority: {
      type: String,
      enum: Object.values(ProjectPriority),
      required: true,
      default: ProjectPriority.MEDIUM,
    },
    deadline: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ProjectStatus),
      required: true,
      default: ProjectStatus.NEW,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    activeAlertIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Alert',
      },
    ],
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
ProjectSchema.index({ status: 1 });
ProjectSchema.index({ priority: 1, deadline: 1 });
ProjectSchema.index({ createdBy: 1 });
ProjectSchema.index({ deadline: 1, status: 1 });

// Virtual: isOverdue
ProjectSchema.virtual('isOverdue').get(function () {
  return (
    this.deadline < new Date() &&
    ![ProjectStatus.COMPLETED, ProjectStatus.DISPATCHED].includes(this.status)
  );
});

const ProjectModel: Model<IProjectDocument> =
  mongoose.models.Project || mongoose.model<IProjectDocument>('Project', ProjectSchema);

export default ProjectModel;
