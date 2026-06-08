# Notification System Revamp Plan

## Current Problems Identified

1. **Push notifications work partially** but are missing for key events:
   - No `PROJECT_CREATED` notification type
   - Internal task creation/assignment has NO notification
   - No overdue task notifications at all
   
2. **In-app notifications are broken** because:
   - `notifyUsers()` writes to `globalThis.__pendingNotifications` which is **never consumed** by the client
   - The client-side `dispatchNotification()` in `client-data.ts` only fires on mutations, not on server-side events
   - No MongoDB persistence — notifications are stored only in `localStorage`, lost across devices/clear
   
3. **Wrong notification types being used** — e.g. project creation uses `TASK_STATUS_CHANGED`

## Fix Plan

### 1. Add Missing Notification Types
- `PROJECT_CREATED` — for new project creation
- `INTERNAL_TASK_ASSIGNED` — for internal task assignments  
- `TASK_OVERDUE` — for overdue task reminders

### 2. Create MongoDB Notification Model
Persist notifications so they survive across devices and sessions.

### 3. Create Notification API Endpoints
- `GET /api/notifications` — fetch user's notifications
- `PATCH /api/notifications/[id]` — mark as read
- `POST /api/notifications/mark-all-read` — mark all as read
- `POST /api/notifications/overdue-check` — check & notify overdue tasks

### 4. Rewrite `notifyUsers()`
Replace the broken `globalThis.__pendingNotifications` with MongoDB persistence.

### 5. Wire Up Missing Server-Side Notifications
- Project creation → `PROJECT_CREATED`
- Internal task + assignment → notification to assigned user
- Task overdue check → `TASK_OVERDUE`

### 6. Fix Client-Side Consumption
- `useInAppNotifications` should fetch from `/api/notifications`
- Add `useSWRMutation` hooks for marking read/dismissing