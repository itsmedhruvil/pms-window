import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IPushSubscriptionDocument extends Document {
  userId: mongoose.Types.ObjectId;
  endpoint: string;
  auth: string;
  p256dh: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscriptionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
    },
    auth: {
      type: String,
      required: true,
    },
    p256dh: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for querying subscriptions by user, and fast deduplication by endpoint
PushSubscriptionSchema.index({ userId: 1, endpoint: 1 }, { unique: true });

const PushSubscriptionModel: Model<IPushSubscriptionDocument> =
  mongoose.models.PushSubscription ||
  mongoose.model<IPushSubscriptionDocument>('PushSubscription', PushSubscriptionSchema);

export default PushSubscriptionModel;