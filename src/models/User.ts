import mongoose, { Document, Model, Schema } from 'mongoose';
import { Department, UserRole } from '@/types';

export interface IUserDocument extends Document {
  clerkId?: string;
  email: string;
  name: string;
  role: UserRole;
  department: Department;
  avatar?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    clerkId: {
      type: String,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
      default: UserRole.DEPARTMENT_USER,
    },
    department: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    avatar: {
      type: String,
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

// Indexes
UserSchema.index({ role: 1 });
UserSchema.index({ department: 1, isActive: 1 });

// Unique index on clerkId only for documents where clerkId is a non-null string
// (partialFilterExpression is more reliable than sparse for excluding nulls)
UserSchema.index(
  { clerkId: 1 },
  {
    unique: true,
    partialFilterExpression: { clerkId: { $type: 'string' } },
  }
);

// Pre-save middleware to handle department migration from old enum values
UserSchema.pre('save', function (next) {
  const oldDepartmentMap: Record<string, Department> = {
    'office_admin': Department.PRODUCTION,
    'marketing': Department.SITE,
  };

  if (this.department && oldDepartmentMap[this.department as string]) {
    this.department = oldDepartmentMap[this.department as string];
  }

  next();
});

// Post-find middleware to handle fetched documents
UserSchema.post('find', function (docs) {
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
UserSchema.post('findOne', function (doc) {
  if (!doc) return;
  
  const oldDepartmentMap: Record<string, Department> = {
    'office_admin': Department.PRODUCTION,
    'marketing': Department.SITE,
  };

  if (doc.department && oldDepartmentMap[doc.department as string]) {
    doc.department = oldDepartmentMap[doc.department as string];
  }
});

const UserModel: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);

export default UserModel;