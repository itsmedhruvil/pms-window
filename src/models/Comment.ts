import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ICommentAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
}

const CommentAttachmentSchema = new Schema<ICommentAttachment>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export interface ICommentDocument extends Document {
  taskId?: mongoose.Types.ObjectId;
  alertId?: mongoose.Types.ObjectId;
  discussionId?: mongoose.Types.ObjectId;
  content: string;
  author: mongoose.Types.ObjectId;
  mentions: mongoose.Types.ObjectId[];
  attachments: ICommentAttachment[];
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
    discussionId: {
      type: Schema.Types.ObjectId,
      ref: 'Discussion',
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
    attachments: {
      type: [CommentAttachmentSchema],
      default: [],
    },
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

// Non-system comments must have either taskId or alertId or discussionId
CommentSchema.pre('validate', function (next) {
  if (!this.isSystemLog && !this.taskId && !this.alertId && !this.discussionId) {
    return next(new Error('Comment must belong to a task, alert, or discussion'));
  }
  next();
});

// Indexes
CommentSchema.index({ taskId: 1, createdAt: 1 });
CommentSchema.index({ alertId: 1, createdAt: 1 });
CommentSchema.index({ discussionId: 1, createdAt: 1 });

const CommentModel: Model<ICommentDocument> =
  mongoose.models.Comment || mongoose.model<ICommentDocument>('Comment', CommentSchema);

export default CommentModel;