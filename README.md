# Window Manufacturing ERP

Production-grade ERP system for window manufacturing operations. Built with Next.js 14 App Router, MongoDB, Clerk auth, and Pusher realtime.

---

## Architecture Overview

```
src/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── projects/             # CRUD + /[id]/status + /[id]/alert
│   │   ├── tasks/                # List + /[id] PATCH + /[id]/assign
│   │   ├── alerts/               # List + Create + /[id] acknowledge/resolve
│   │   ├── comments/             # Threaded comments (task OR alert)
│   │   ├── dashboard/            # Aggregation metrics endpoint
│   │   ├── users/                # List + /[id] PATCH/DELETE
│   │   └── webhooks/clerk/       # Clerk user sync webhook
│   ├── dashboard/                # Operations overview
│   ├── projects/                 # List, detail, new order form
│   ├── tasks/                    # My tasks (list + kanban)
│   ├── alerts/                   # Global alert management
│   └── users/                    # User management (admin only)
├── components/
│   ├── alert/                    # AlertSidebar (persistent panel)
│   ├── comment/                  # CommentThread with @mentions
│   ├── dashboard/                # DashboardMetrics (recharts)
│   ├── forms/                    # CreateProjectForm, CreateAlertForm
│   ├── kanban/                   # KanbanBoard with DnD
│   ├── layout/                   # AppLayout (nav sidebar)
│   ├── project/                  # ProjectDetail, ProjectStatusControl
│   ├── task/                     # TaskAssignPanel
│   └── ui/                       # Badges, Skeletons, Modal, ErrorBoundary
├── hooks/
│   └── useRealtime.ts            # Pusher channel subscriptions
├── lib/
│   ├── auth.ts                   # withAuth() middleware, role guards
│   ├── db.ts                     # Mongoose connection (cached)
│   ├── pusher.ts                 # Server + client Pusher helpers
│   ├── utils.ts                  # cn(), date helpers, style maps
│   ├── validations.ts            # Zod schemas for all inputs
│   └── workflow.ts               # Task generation, state engine
├── models/                       # Mongoose schemas (User/Project/Task/Alert/Comment)
├── middleware.ts                 # Clerk route protection
└── types/index.ts                # All TypeScript types + enums
```

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18.17+ |
| npm | 9+ |
| MongoDB Atlas | Free tier works |
| Clerk account | Free tier works |
| Pusher Channels | Sandbox tier works |

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo>
cd erp-window
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
MONGODB_URI=mongodb+srv://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
PUSHER_APP_ID=...
NEXT_PUBLIC_PUSHER_KEY=...
PUSHER_SECRET=...
NEXT_PUBLIC_PUSHER_CLUSTER=ap2
```

### 3. Set up Clerk

1. Create a Clerk application at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Copy your API keys into `.env.local`
3. In Clerk dashboard → **Webhooks** → Add endpoint:
   - URL: `https://your-domain.com/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
4. Copy the webhook signing secret into `CLERK_WEBHOOK_SECRET`

> **First user setup**: After signing up, go to MongoDB and manually set
> `role: "super_admin"` and `department: "office_admin"` on your user document,
> or set `public_metadata` in Clerk dashboard before signing up.

### 4. Set up Pusher

1. Create a Channels app at [dashboard.pusher.com](https://dashboard.pusher.com)
2. Copy App ID, Key, Secret, and Cluster into `.env.local`
3. Enable client events in Pusher app settings if needed

### 5. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Seed sample data (optional)

```bash
# Install ts-node if needed
npm install -D ts-node dotenv

# Run seed
npx ts-node --project tsconfig.json scripts/seed.ts
```

This creates:
- 5 users (1 admin + 4 dept users)
- 4 projects in different lifecycle stages
- ~56 workflow tasks
- 1 active alert with comment thread

---

## Core Concepts

### Department Workflow Sequence

```
Office Admin → Purchase → Store → Marketing
```

Each project auto-generates tasks in this order. Tasks are **dependency-locked** — a department cannot start until the previous department's final task is `Done`.

### Project Lifecycle

```
New → In Production → [On Hold] → Completed → Dispatched
```

- `On Hold` is triggered automatically when any alert becomes `Active`
- Cannot move to `Completed` unless all tasks are `Done`
- Cannot resume `In Production` while active alerts exist

### Alert Workflow (strictly enforced)

```
Admin raises alert
    ↓
Project → On Hold
Affected dept tasks → Blocked
    ↓
Dept users acknowledge
    ↓  (requires comment thread)
Admin resolves
    ↓
Project → In Production
Tasks → unblocked
```

No bypass. Resolution requires:
1. At least one acknowledgment
2. Minimum 2 comments in the thread

### Task State Machine

```
Todo → In Progress → Done
           ↑
      (can revert)

Blocked (set by alerts — cannot transition until resolved)
```

Locked tasks (dependency not met) show disabled UI and reject API transitions.

---

## API Reference

All routes require Clerk authentication. Role restrictions are noted.

### Projects

| Method | Route | Role | Description |
|---|---|---|---|
| GET | `/api/projects` | All | List with filters: `status`, `priority`, `search`, `page`, `limit` |
| POST | `/api/projects` | Admin+ | Create project + auto-generate tasks |
| GET | `/api/projects/:id` | All | Detail with tasks + alerts |
| PATCH | `/api/projects/:id` | Admin+ | Update fields |
| DELETE | `/api/projects/:id` | Super Admin | Cascade delete |
| POST | `/api/projects/:id/status` | Admin+ | Status transition with validation |
| POST | `/api/projects/:id/alert` | Admin+ | Raise alert on project |
| GET | `/api/projects/:id/alert` | All | List project alerts |

### Tasks

| Method | Route | Role | Description |
|---|---|---|---|
| GET | `/api/tasks` | All | List, filtered by `projectId`, `department`, `status` |
| GET | `/api/tasks/:id` | All | Single task with dependency info |
| PATCH | `/api/tasks/:id` | Dept User+ | Update status/fields (dept-scoped) |
| POST | `/api/tasks/:id/assign` | Dept User+ | Assign/unassign user (same dept only) |

### Alerts

| Method | Route | Role | Description |
|---|---|---|---|
| GET | `/api/alerts` | All | List, filtered by `projectId`, `status` |
| POST | `/api/alerts` | Admin+ | Create alert (triggers workflow freeze) |
| PATCH | `/api/alerts/:id` | All | `{ action: "acknowledge" }` or `{ action: "resolve" }` |

### Comments

| Method | Route | Role | Description |
|---|---|---|---|
| GET | `/api/comments` | All | List by `taskId` or `alertId`, paginated |
| POST | `/api/comments` | All | Create comment with optional `mentions` |

### Dashboard

| Method | Route | Role | Description |
|---|---|---|---|
| GET | `/api/dashboard` | All | All metrics, charts, and active alerts |

### Users

| Method | Route | Role | Description |
|---|---|---|---|
| GET | `/api/users` | All | List active users, filterable by `department`, `role` |
| GET | `/api/users/:id` | All | Single user |
| PATCH | `/api/users/:id` | Admin+ | Update role/department |
| DELETE | `/api/users/:id` | Super Admin | Deactivate + unassign tasks |

---

## Realtime Events (Pusher)

### Channels

| Channel | Used For |
|---|---|
| `project-{id}` | Per-project events |
| `erp-global` | System-wide alerts |
| `dept-{dept}` | Department-specific (future) |

### Events

| Event | Channel | Payload |
|---|---|---|
| `alert_created` | `erp-global` | `{ alertId, projectId, severity, type }` |
| `alert_updated` | `project-{id}` | Full alert object |
| `task_updated` | `project-{id}` | Full task object |
| `project_status_changed` | `project-{id}` | `{ projectId, status, completionPercentage }` |
| `comment_added` | `project-{id}` | `{ comment, taskId?, alertId? }` |

---

## Role Permissions Matrix

| Action | Dept User | Admin | Super Admin |
|---|---|---|---|
| View own dept tasks | ✅ | ✅ | ✅ |
| View all tasks | ❌ | ✅ | ✅ |
| Update own dept tasks | ✅ | ✅ | ✅ |
| Create projects | ❌ | ✅ | ✅ |
| Delete projects | ❌ | ❌ | ✅ |
| Raise alerts | ❌ | ✅ | ✅ |
| Acknowledge alerts | ✅ (own dept) | ✅ | ✅ |
| Resolve alerts | ❌ | ✅ | ✅ |
| Manage users | ❌ | Edit only | Full |
| Deactivate users | ❌ | ❌ | ✅ |
| View dashboard | ✅ | ✅ | ✅ |

---

## MongoDB Indexes

Applied automatically by Mongoose schemas:

```
users:    { clerkId: 1 }  { department: 1, isActive: 1 }
projects: { status: 1 }  { priority: 1, deadline: 1 }
tasks:    { projectId: 1, department: 1 }  { projectId: 1, status: 1 }  { projectId: 1, sequence: 1 }
alerts:   { projectId: 1, status: 1 }  { status: 1, severity: 1 }
comments: { taskId: 1, createdAt: 1 }  { alertId: 1, createdAt: 1 }
```

---

## Design System

- **Font**: IBM Plex Mono (headings, badges, labels) + IBM Plex Sans (body)
- **Color**: Pure monochrome — **red is reserved exclusively for alerts**
- **Corners**: Zero border-radius (sharp corners everywhere, factory aesthetic)
- **Density**: Compact cards, tight spacing, information-first
- **Status indicators**: Animated pulse on `ACTIVE` alerts and `BLOCKED` tasks

---

## Production Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set all environment variables in Vercel dashboard under Project → Settings → Environment Variables.

Update Clerk webhook URL to `https://your-production-domain.com/api/webhooks/clerk`.

---

## Scripts

```bash
npm run dev          # Development server (http://localhost:3000)
npm run build        # Production build
npm run type-check   # TypeScript check without emit
npm run lint         # ESLint

# Database
npx ts-node --project tsconfig.json scripts/seed.ts   # Seed sample data
```

---

## Key Design Decisions

**Why server-first architecture?**
Dashboard metrics, project lists, and user data are rendered on the server. Only interactive components (Kanban, comment thread, alert sidebar) are client components. This keeps the initial load fast and avoids unnecessary client state.

**Why is alert resolution gated on comment count?**
Alerts represent real operational breakdowns. Resolving without discussion creates audit gaps. The 2-comment minimum forces at least one exchange between the raiser and affected department before workflow resumes.

**Why can't department users see other departments' tasks?**
Factory floor reality. A Purchase department user seeing Store tasks creates noise and false accountability. Siloed views enforce clear responsibility chains.

**Why no optimistic UI on task status changes?**
The Kanban board does use optimistic updates. But status changes are validated server-side against the dependency chain and active alert state — a rejected transition needs to revert immediately, so the UX optimism is strictly bounded by what the server would allow.
