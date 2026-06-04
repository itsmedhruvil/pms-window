import mongoose, { Document, Model, Schema } from 'mongoose';
import { ProjectPriority, ProjectStatus } from '@/types';

export interface IProjectDocument extends Document {
  projectTitle: string;
  clientName: string;
  description?: string;
  pdfAttachments?: Array<{
    id: string;
    name: string;
    url: string;
    size: number;
    uploadedAt: Date;
  }>;
  totalWindows: number;
  windowSpecifications: Array<{
    width: number;
    height: number;
    design: string;
    glassType: string;
    quantity: number;
    notes?: string;
    templateGroupId?: mongoose.Types.ObjectId;
    designPdf?: {
      id: string;
      name: string;
      url: string;
      size: number;
      uploadedAt: Date;
    };
  }>;
  selectedTemplateGroupId?: mongoose.Types.ObjectId;
  excelSheetName?: string;
  excelRows?: Array<Record<string, string | number | boolean | null>>;
  excelFile?: { name: string; data: string; size: number };
  priority: ProjectPriority;
  startDate?: Date;
  deadline: Date;
  endDate?: Date;
  status: ProjectStatus;
  createdBy: mongoose.Types.ObjectId;
  assignedUsers: mongoose.Types.ObjectId[];
  activeAlertIds: mongoose.Types.ObjectId[];
  completionPercentage: number;
  address: string;
  contactPhone: string;
  budget: number;
  productTypes: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProjectDocument>(
  {
    projectTitle: { type: String, required: true, trim: true },
    clientName: { type: String, trim: true, default: '' },
    description: { type: String, trim: true },
    pdfAttachments: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        url: { type: String, required: true },
        size: { type: Number, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    totalWindows: { type: Number, default: 0, min: 0 },
    windowSpecifications: [
      {
        width: { type: Number, default: 0 },
        height: { type: Number, default: 0 },
        design: { type: String, trim: true, default: '' },
        glassType: { type: String, trim: true, default: '' },
        quantity: { type: Number, default: 1, min: 1 },
        notes: { type: String, trim: true },
        templateGroupId: { type: Schema.Types.ObjectId, ref: 'TemplateGroup' },
        designPdf: {
          id: { type: String },
          name: { type: String },
          url: { type: String },
          size: { type: Number },
          uploadedAt: { type: Date, default: Date.now },
        },
      },
    ],
    selectedTemplateGroupId: { type: Schema.Types.ObjectId, ref: 'TemplateGroup' },
    excelSheetName: { type: String, trim: true },
    excelRows: [{ type: Schema.Types.Mixed }],
    excelFile: {
      type: {
        name: { type: String },
        data: { type: String },
        size: { type: Number },
      },
      default: null,
    },
    priority: { type: String, enum: Object.values(ProjectPriority), required: true, default: ProjectPriority.NECESSARY },
    startDate: { type: Date, default: null },
    deadline: { type: Date, required: true },
    endDate: { type: Date, default: null },
    status: { type: String, enum: Object.values(ProjectStatus), required: true, default: ProjectStatus.NEW },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    activeAlertIds: [{ type: Schema.Types.ObjectId, ref: 'Alert' }],
    address: { type: String, trim: true, default: '' },
    contactPhone: { type: String, trim: true, default: '' },
    budget: { type: Number, default: 0, min: 0 },
    completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
    productTypes: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true }],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

ProjectSchema.index({ status: 1, deadline: 1, priority: -1 });
ProjectSchema.index({ priority: -1, deadline: 1, createdAt: -1 });
ProjectSchema.index({ createdBy: 1, status: 1 });
ProjectSchema.index({ deadline: 1, status: 1 });
ProjectSchema.index({ clientName: 'text', projectTitle: 'text' });
ProjectSchema.index({ tags: 1 });

const ProjectModel: Model<IProjectDocument> =
  mongoose.models.Project || mongoose.model<IProjectDocument>('Project', ProjectSchema);

export default ProjectModel;