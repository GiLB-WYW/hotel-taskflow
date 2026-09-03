---
name: Daily summary access
description: Access policy for generated resolved-task summaries written to the shared activity log.
---

Generated daily summaries must be restricted to roles with organization-wide task visibility.

**Why:** The summary is persisted in a shared activity log, so allowing a user to generate a summary of only their own tasks could still disclose those task titles and locations to other log readers.

**How to apply:** Keep summary generation behind the same broad-read authorization boundary as the tasks it aggregates; the trusted scheduler may continue generating organization-wide summaries.