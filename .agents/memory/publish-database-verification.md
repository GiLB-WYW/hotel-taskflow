---
name: Publish database verification
description: How to verify that schema changes are in the database Replit compares during Publish.
---

Confirm schema changes through Replit’s managed development-database query path before assuming they are ready for production publishing.

**Why:** A successful local migration command can use a separately configured database URL. In that case, the app’s migration appears successful while Replit’s development and production schema comparison still sees neither the new table nor a pending diff.

**How to apply:** After database schema work, query the managed development database for the expected tables or columns and inspect the development-to-production schema diff. Publish only after that diff contains the intended, non-destructive changes.