# Threat Model

## Project Overview

Hôtel TaskFlow is a public autoscale Progressive Web Application for hotel maintenance operations. A React/Vite client is served by a Node.js/Express production server (`server/index-prod.ts`, `server/app.ts`, and `server/routes.ts`). The server uses PostgreSQL through Drizzle ORM, bcrypt-backed passwords, Express sessions, Google ID-token verification, Replit Object Storage, and optional Replit AI/Resend integrations. Users include Admins, Coordinators, Managers, Personnel, and Basic Staff; task visibility for non-admin roles is based on creator, assignee, and maintenance-group relationships.

## Assets

- **Accounts and sessions** — passwords, session cookies, OAuth identities, invitations, and role/group assignments. Compromise enables impersonation or privilege escalation.
- **Maintenance records** — task descriptions, locations, priorities, assignments, notes, notifications, photos, and attachments. These contain operational and potentially personal information.
- **Operational integrity** — task status/assignment history and activity logs used for coordination and reporting.
- **Preparation and purchasing data** — projects, plans, supplier information, quotes, invoice metadata, and cost rollups.
- **Application integrations and stored files** — PostgreSQL data, Replit object-storage credentials, private documents, and AI/email connector credentials.

## Trust Boundaries

- **Browser to Express API** — all client data, IDs, URLs, roles, and localStorage values are attacker-controlled; every sensitive read and mutation must be authorized server-side.
- **Authenticated user to another user/group** — Managers are limited by task group/assignment visibility, while Admins and Coordinators have broader preparation access. Notification, notes, task, and activity-log paths must preserve these boundaries.
- **Express to PostgreSQL** — request-derived values reach Drizzle queries and state mutations; queries must remain parameterized and scoped to the authorized object.
- **Express to Object Storage and Replit sidecars** — uploaded files and proxy fetches cross into privileged storage services; user-controlled URLs must not select internal destinations.
- **Express to AI/email connectors** — user text and invitation/profile data are sent to external services; credentials must remain server-side and requests must be bounded.
- **Production versus development/seed code** — `server/index-prod.ts` serves the public deployment; `server/seed.ts`, `server/index-dev.ts`, mock data, and development plugins are not production surfaces unless explicitly wired into the deployment.

## Scan Anchors

- **Production entry points:** `server/index-prod.ts`, `server/app.ts`, `server/routes.ts`, and object routes in `server/replit_integrations/object_storage/routes.ts`.
- **Highest-risk areas:** session middleware and auth routes; `canReadTask` versus task mutations; notifications/notes/activity logs; debug routes; task thumbnail proxy; object-storage upload/serve paths; preparation project and invoice routes.
- **Public/authenticated/admin:** auth login/OAuth/invitation acceptance and Google config are public; the `/api` middleware requires a session for other API routes; Admin-only and Admin/Coordinator preparation gates protect privileged management APIs.
- **Dev-only:** `server/seed.ts`, `server/index-dev.ts`, `client/src/lib/mockData.ts`, and Vite/Replit development plugins.

## Threat Categories

### Spoofing

The server must establish the user from the signed, HttpOnly Express session rather than client localStorage. Password login must verify bcrypt hashes, Google login must verify issuer/audience/signature and verified email, and invitation tokens must be high-entropy, expiring, single-use bearer credentials. Session identifiers should be rotated when a user authenticates.

### Tampering

Task status, assignment, creator, group, attachments, project costs, quotes, and activity-log authorship are valuable state. The server MUST authorize the acting subject against the exact target object before every write and MUST derive actor/author fields from the session. Client-supplied role, ownership, group, price, and tenant-like identifiers must not override server policy.

### Information Disclosure

Task, note, notification, activity, invoice, and file responses MUST be scoped to the caller's permitted task/group/project scope. Debug and reporting endpoints must not bypass those filters. Password hashes, connector credentials, invitation tokens, and private object contents must never be returned to ordinary users or logged. Client storage is public and may contain only non-sensitive display metadata.

### Denial of Service

Public authentication and AI endpoints, 50 MB request parsing, image/file proxying, report generation, and object-storage operations require rate limits, bounded response sizes, timeouts, and input limits. Untrusted AI input and image URLs must not permit unbounded cost or resource consumption.

### Elevation of Privilege

Admin and Coordinator preparation operations and Admin user/role management MUST be enforced server-side. Manager task operations MUST use the same creator/assignee/group policy as task reads. Notification IDs, task IDs, project IDs, and file paths are untrusted object references and require object-level authorization.

### Repudiation

Sensitive task, role, invitation, password, file, and activity-log changes should record the authenticated actor and immutable audit details. Activity records must not accept arbitrary author identity or be freely edited/deleted by unrelated users. Logs must avoid emails, credentials, password-related data, and full private API responses.
