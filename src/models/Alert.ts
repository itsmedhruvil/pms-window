import mongoose, { Document, Model, Schema } from 'mongoose';
import { AlertType, AlertStatus, AlertSeverity, Department } from '@/types';

export interface IAlertDocument extends Document {
  projectId: mongoose.Types.ObjectId;
  taskId?: mongoose.Types.ObjectId;
  type: AlertType;
  message: string;
  raisedBy: mongoose.Types.ObjectId;
  affectedDepartments: Department[];
  status: AlertStatus;
  severity: AlertSeverity;
  acknowledgedBy: mongoose.Types.ObjectId[];
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AlertSchema = new Schema<IAlertDocument>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    type: {
      type: String,
      enum: [AlertType.DESIGN_CHANGE, AlertType.CLIENT_ESCALATION, AlertType.PRODUCTION_ISSUE, AlertType.MATERIAL_ISSUE],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
    },
    raisedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    affectedDepartments: {
      type: [String],
      required: true,
      validate: {
        validator: (v: unknown[]) => v.length > 0,
        message: 'At least one affected department is required',
      },
    },
    status: {
      type: String,
      enum: Object.values(AlertStatus),
      required: true,
      default: AlertStatus.ACTIVE,
    },
    severity: {
      type: String,
      enum: Object.values(AlertSeverity),
      required: true,
    },
    acknowledgedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
AlertSchema.index({ projectId: 1, status: 1 });
AlertSchema.index({ status: 1, severity: 1 });
AlertSchema.index({ createdAt: -1 });

const AlertModel: Model<IAlertDocument> =
  mongoose.models.Alert || mongoose.model<IAlertDocument>('Alert', AlertSchema);

export default AlertModel;
