# Admin Dashboard & Global Header – Implementation Plan

## 1. Objectives & Scope

- Provide an **Admin Dashboard** that lets authorized admins:
  - Manage users and roles.
  - Monitor site and study activity.
  - Configure system-wide settings and feature flags.
- Introduce a **global header** that shows the **logged-in username** and **active `study_id`** at the top-right of **every page**, tightly integrated with the existing study-centric architecture.
- Emphasize **usability**, **security**, and **performance**, and ensure no regressions to existing ADAM_AI functionality.

---

## 2. High-Level Architecture

- **Frontend**
  - React 18 + TypeScript + Ant Design.
  - New route: `/admin` with nested tabs: `Overview`, `Users`, `Activity & Logs`, `Settings`.
  - Shared `AppLayout` component that:
    - Renders the global header (username + study selector).
    - Wraps all existing pages (ADaM generator, Pre-P21, ADRG/SDRG, eCTD, TLF generator, Enter Study Details, etc.).
  - State management via existing Zustand stores:
    - `authStore` – user info, roles, auth token.
    - `studyStore` – current `study_id`, list of accessible studies.

- **Backend (FastAPI)**
  - Admin-specific router under `/admin` with endpoints for:
    - User management: list, create, update roles, activate/deactivate.
    - Analytics: aggregate metrics on usage, errors, study activity.
    - Settings: application configuration and feature flags.
  - Security via:
    - Auth dependency that validates token/session.
    - Role-based access control (RBAC) checks ensuring only admins hit `/admin/*`.

- **Data**
  - Leverage existing `users` table (or equivalent) with:
    - `role` or `roles` (e.g., `ADMIN`, `DEV`, `VIEWER`).
    - `is_active`, `last_login_at` etc.
  - Add or extend:
    - `UserActivityLog` table for tracking key events.
    - `AppSetting` table for system configuration and feature flags.

---

## 3. Global Header: Username & Study ID

### 3.1 Requirements

- Display **username** (and optionally role) and **current study ID** in the top-right corner of every page.
- Allow quick **study switching** where applicable (e.g., via dropdown).
- Be visible in all major app sections and consistent in style.
- Do not expose study selector on pages where a study context is irrelevant (e.g., login).

### 3.2 Frontend Design

- Create `AppHeader` component with:
  - Left: app logo / name and current module title.
  - Center: optional breadcrumbs or active page title.
  - Right:
    - `StudySelector` (from study module plan) showing current `study_id` (and name).
    - User avatar / username dropdown: profile, sign-out, “Admin Dashboard” (if role permits).
  - Integrate with:
    - `authStore` → `currentUser` (username, roles).
    - `studyStore` → `currentStudyId`, `studies`.

- Layout integration:
  - Create `AppLayout` that wraps all routes after login:
    - `<AppHeader />`
    - `<SideNav />` (optional).
    - `<Content />` (React Router outlet).
  - Refactor existing pages to render inside `AppLayout` so the header is always present.

### 3.3 Backend Considerations

- Ensure username and roles are returned in the auth payload (e.g., `/auth/me`):
  - `{"username": "...", "roles": ["ADMIN", "DEV"], "display_name": "..."}`.
- Ensure study access control is enforced server-side:
  - For endpoints that accept `study_id`, validate that:
    - The `study_id` exists.
    - The user has permission to access it.

### 3.4 Edge Cases

- **No study selected**:
  - Show placeholder `No study selected` and optionally warn when a feature requires a study.
- **Multiple studies**:
  - Study selector lists only studies the user can access.
- **System admin with no specific study**:
  - Header still shows username; study selector optional/disabled on purely admin pages.

---

## 4. Admin Dashboard – Functional Design

### 4.1 Access & Navigation

- Route: `/admin`.
- Visible only for users with `ADMIN` role (or higher).
- Entry points:
  - Link in the user dropdown (top-right).
  - Optional left-side navigation item (“Admin”).
- Unauthorized access:
  - Frontend: guard route (redirect to 403/Not Authorized page).
  - Backend: return 403 with clear message if non-admin hits `/admin/*`.

### 4.2 Overview Tab

- Cards showing key metrics (with study filter):
  - Total users / active users.
  - Number of studies.
  - Recent ADaM generations / TLF runs.
  - Errors / failed jobs in the last 24 hours.
- Small activity timeline (recent admin actions, user logins, study changes).

### 4.3 Users Tab

- Table with:
  - Columns: Username, Role(s), Status (active/locked), Last login, Created At, Actions.
  - Filters: role, status, search by username/email.
  - Pagination and sorting (server-side).
- Actions (role-aware and audited):
  - Create user:
    - Form: username, email, role(s), temporary password or invite flow.
  - Edit user:
    - Update role(s), lock/unlock account, change study access scope.
  - Deactivate user:
    - Soft delete / set `is_active=false`.
- Implement bulk actions with confirmation (e.g., lock multiple users).

### 4.4 Activity & Logs Tab

- Views:
  - User activity:
    - Logins, logouts, failed attempts.
    - Critical actions (document uploads, study changes, code generation runs).
  - System events:
    - Errors/exceptions aggregated by type/endpoints.
    - Queue/worker health if Celery/Redis is used.
- Filters:
  - Time range, user, `study_id`, event type.
- Backend:
  - `UserActivityLog` model:
    - `id`, `user_id`, `action`, `study_id` (optional), `timestamp`, `metadata` (JSON), `ip_address`.
  - APIs:
    - `GET /admin/activity` with query params: `user`, `study_id`, `from`, `to`, `event_type`, `page`, `page_size`.

### 4.5 Settings Tab

- Categories:
  - General app settings (e.g., default LLM model, feature flags).
  - Security settings (password policy, session timeout).
  - Study-related defaults (e.g., default ADaM/SDTM versions).
- Backend:
  - `AppSetting` model:
    - `key`, `value` (JSON), `category`, `description`, `updated_at`, `updated_by_user_id`.
  - APIs:
    - `GET /admin/settings` – list all settings grouped by category.
    - `PUT /admin/settings` – update selected settings.
- Frontend:
  - Forms with:
    - Validation (type-safe inputs).
    - Clear descriptions for each setting.
  - Guardrails:
    - Confirmations for risky changes.
    - Restricted editing of critical settings to super-admins (if applicable).

---

## 5. Security Considerations

- **RBAC Enforcement**
  - Backend dependency (`get_current_admin_user`) that:
    - Validates JWT/session.
    - Checks `ADMIN` (or `SUPER_ADMIN`) role.
  - All `/admin/*` routes use this dependency; no admin logic in unauthenticated endpoints.

- **Auditability**
  - Every admin action (user role change, settings update, study access updates) is logged to `UserActivityLog` with:
    - Actor user id, timestamp.
    - Target entity (user, study, setting key).
    - Old vs new value (where safe).

- **Least Privilege**
  - Non-admin users cannot access admin endpoints even if they know URLs.
  - API responses only return necessary fields (no password hashes, secrets).

- **Session & CSRF**
  - Reuse existing secure session mechanism (JWT, cookies).
  - Consider short-lived tokens for admin operations and additional re-auth for high-risk actions (password reset, settings change).

---

## 6. Performance Considerations

- **User Management**
  - Pagination and server-side filtering to avoid loading thousands of users at once.
  - Index database columns used in filters (username, role, `is_active`, `last_login_at`).

- **Analytics & Logs**
  - Avoid heavy aggregations on every page load:
    - Pre-aggregate metrics periodically or cache results (e.g., Redis) for short intervals (30–60 seconds).
  - Paginate logs listings and provide lazy loading.

- **Global Header**
  - Read `currentUser` and `currentStudy` from stores, not by re-calling APIs on every route change.
  - Listen to route changes and update only the page title; keep header static for fast navigation.

---

## 7. Implementation Phases

1. **Phase 1 – Foundations**
   - Finalize RBAC model (`roles`, `permissions`).
   - Implement `AppLayout` and `AppHeader`, integrate username + study selector globally.

2. **Phase 2 – Admin APIs**
   - Implement `/admin/users`, `/admin/activity`, `/admin/settings` endpoints with full RBAC and logging.
   - Add `UserActivityLog` and `AppSetting` models + migrations.

3. **Phase 3 – Admin UI**
   - Build `/admin` route with `Overview`, `Users`, `Activity & Logs`, `Settings` tabs.
   - Hook UI components to the new APIs, including pagination and filters.

4. **Phase 4 – Hardening**
   - Add tests for RBAC, admin endpoints, and global header behavior.
   - Load/performance tests for analytics queries.
   - UX polish for responsiveness and accessibility.

5. **Phase 5 – Rollout**
   - Behind feature flag (e.g., `ENABLE_ADMIN_DASHBOARD`).
   - Limited rollout to internal admins, monitor logs and performance.
   - Remove flag once stable.

---

## 8. Open Questions / Clarifications

- What roles should be supported out of the box (`ADMIN`, `SUPER_ADMIN`, `DEV`, `VIEWER`, etc.)?
- Are there existing audit logging mechanisms that the admin activity view should reuse?
- Should admins be able to manage **study access** per user (e.g., which studies a user can see)?
- Which analytics metrics are essential for the first version (e.g., ADaM generations per study, error rates, queue health)?
- Are there regulatory constraints preventing certain actions (e.g., impersonation, forced password resets) in this environment?

