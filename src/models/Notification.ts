import mongoose, { Schema, Document } from 'mongoose';
import { NotificationType } from '@/types/notifications';

export interface INotificationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  read: boolean;
  dismissed: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: '/' },
    read: { type: Boolean, default: false },
    dismissed: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        const { __v, ...rest } = ret;
        return rest;
      },
    },
  }
);

// Compound index for efficient querying
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, dismissed: 1, createdAt: -1 });

export default mongoose.models.Notification ||
  mongoose.model<INotificationDocument>('Notification', NotificationSchema);