import mongoose, { Document, Model, Schema } from 'mongoose';

export type NotificationType = 
  | 'discussion_mention'
  | 'discussion_reply'
  | 'task_due_soon'
  | 'task_overdue'
  | 'task_assigned'
  | 'alert_created'
  | 'alert_acknowledged'
  | 'alert_resolved';

export interface INotificationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  relatedId?: mongoose.Types.ObjectId;
  relatedModel?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'discussion_mention',
        'discussion_reply',
        'task_due_soon',
        'task_overdue',
        'task_assigned',
        'alert_created',
        'alert_acknowledged',
        'alert_resolved',
      ],
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    link: {
      type: String,
      default: null,
    },
    relatedId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    relatedModel: {
      type: String,
      default: null,
    },
    isRead: {
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

// Indexes
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: -1 });

const NotificationModel: Model<INotificationDocument> =
  mongoose.models.Notification || mongoose.model<INotificationDocument>('Notification', NotificationSchema);

export default NotificationModel;