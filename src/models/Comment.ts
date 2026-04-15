import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ICommentDocument extends Document {
  taskId?: mongoose.Types.ObjectId;
  alertId?: mongoose.Types.ObjectId;
  content: string;
  author: mongoose.Types.ObjectId;
  mentions: mongoose.Types.ObjectId[];
  isSystemLog: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<ICommentDocument>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
      index: true,
    },
    alertId: {
      type: Schema.Types.ObjectId,
      ref: 'Alert',
      default: null,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mentions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isSystemLog: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Non-system comments must have either taskId or alertId
CommentSchema.pre('validate', function (next) {
  if (!this.isSystemLog && !this.taskId && !this.alertId) {
    return next(new Error('Comment must belong to a task or alert'));
  }
  next();
});

// Indexes
CommentSchema.index({ taskId: 1, createdAt: 1 });
CommentSchema.index({ alertId: 1, createdAt: 1 });

const CommentModel: Model<ICommentDocument> =
  mongoose.models.Comment || mongoose.model<ICommentDocument>('Comment', CommentSchema);

export default CommentModel;
