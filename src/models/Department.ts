import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IDepartmentDocument extends Document {
  name: string;        // internal slug e.g. 'production'
  label: string;       // display name e.g. 'Production'
  abbreviation: string; // short form e.g. 'PROD'
  sequence: number;    // ordering
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartmentDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    abbreviation: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 6,
    },
    sequence: {
      type: Number,
      required: true,
      default: 0,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

DepartmentSchema.index({ sequence: 1 });
DepartmentSchema.index({ isActive: 1 });

const DepartmentModel: Model<IDepartmentDocument> =
  mongoose.models.Department || mongoose.model<IDepartmentDocument>('Department', DepartmentSchema);

export default DepartmentModel;