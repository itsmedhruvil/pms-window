# Access Summary — Role-Based Permissions

This document describes what each user role can see and do in the Unique Arts PMS application.

## Roles Overview

| Role | Description |
|------|-------------|
| **Super Admin** | Full system access. Can manage users, projects, tasks, alerts, and all configuration including template groups and role assignments. |
| **Admin** | Broad management access. Can create and manage projects, view all tasks and alerts, manage users (except role changes to Super Admin). |
| **Department User** | Department-scoped access. Can only see and work on tasks and alerts assigned to their specific department. |

---

## Feature Permissions Matrix

| Feature | Description | Super Admin | Admin | Dept User |
|---------|-------------|-------------|-------|-----------|
| Dashboard | Overview metrics, project stats, task completion rates, alerts summary | Full view — all stats, bottlenecks, trends | Full view — all stats, bottlenecks, trends | View — only their department metrics |
| Projects | View project list, search, filter by status/priority | View all projects | View all projects | View only assigned projects |
| Create Project | Create new project with client info, total windows count, deadline. Window specifications added later via Excel upload | Full access — create projects with optional template group | Full access — create projects with optional template group | No access |
| Project Detail | View project info, tasks, alerts. Upload Excel for window specifications. Edit project details | Full access — edit details, upload Excel, change status, reassign | Full access — edit details, upload Excel, change status, reassign | View only — cannot upload Excel or edit |
| Department Tasks | View tasks filtered by department (6 departments) | View all department task boards | View all department task boards | View only their own department tasks |
| Task CRUD | Create, edit, delete, reassign tasks within a project or internal | Full access — all tasks | Full access — all tasks | Edit only own tasks — cannot delete or reassign |
| Task Assignment | Assign users to tasks, reassign between team members | Can assign any user to any task | Can assign any user to any task | Cannot assign or reassign |
| Internal Tasks | Create and manage internal (non-project) tasks | Full access | Full access | No access |
| Template Groups | Manage reusable task template groups for window types | Full access — create, edit, delete | Full access — create, edit, delete | No access |
| Alerts | Create, acknowledge, resolve alerts. View alert history | View all alerts, acknowledge & resolve any | View all alerts, acknowledge & resolve any | View only department alerts, create alerts, acknowledge own |
| Users | View all users, manage roles, deactivate accounts | Full access — edit roles, deactivate any user | Manage users (except cannot promote to Super Admin) | No access |
| Create Users | Invite new team members to the system | Can create users with any role | Can create users (except Super Admin) | No access |
| Access Summary | View this roles & permissions reference page | Full view | Full view | Full view |

---

## Legend

- 🟢 **Full / Edit access** — User can fully manage this feature
- 🔵 **View only** — User can see but cannot modify
- 🟡 **Conditional / Can** — Access depends on additional conditions (e.g., own department scope)
- ⚪ **No access** — Feature is hidden or unavailable to this role

---

*Last updated: February 2026*