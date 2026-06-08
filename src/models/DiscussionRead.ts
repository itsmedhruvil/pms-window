import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IDiscussionReadDocument extends Document {
  discussionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  lastReadAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DiscussionReadSchema = new Schema<IDiscussionReadDocument>(
  {
    discussionId: {
      type: Schema.Types.ObjectId,
      ref: 'Discussion',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastReadAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient lookups
DiscussionReadSchema.index({ discussionId: 1, userId: 1 }, { unique: true });
DiscussionReadSchema.index({ userId: 1 });

const DiscussionReadModel: Model<IDiscussionReadDocument> =
  mongoose.models.DiscussionRead ||
  mongoose.model<IDiscussionReadDocument>('DiscussionRead', DiscussionReadSchema);

export default DiscussionReadModel;