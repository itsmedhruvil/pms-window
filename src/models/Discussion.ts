import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IDiscussionDocument extends Document {
  projectId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  startedBy: mongoose.Types.ObjectId;
  mentions: mongoose.Types.ObjectId[]; // Users who have access (starter + @mentioned)
  lastMessageAt: Date; // Timestamp of the most recent comment — used for unread tracking
  createdAt: Date;
  updatedAt: Date;
}

const DiscussionSchema = new Schema<IDiscussionDocument>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
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
      default: '',
      trim: true,
    },
    startedBy: {
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
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
DiscussionSchema.index({ projectId: 1, createdAt: -1 });
DiscussionSchema.index({ mentions: 1 });
DiscussionSchema.index({ startedBy: 1 });

const DiscussionModel: Model<IDiscussionDocument> =
  mongoose.models.Discussion || mongoose.model<IDiscussionDocument>('Discussion', DiscussionSchema);

export default DiscussionModel;