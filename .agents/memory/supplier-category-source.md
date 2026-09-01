---
name: Supplier category source
description: Defines which shared taxonomy supplier directory categories must use.
---

Supplier categories must reuse the Preparation trade catalogue and support multiple categories per supplier through a normalized relation.

**Why:** Plumbing, Electrical, General Works, and the other requested supplier categories already exist as Preparation trades. Reusing them avoids two competing taxonomies that would drift over time.

**How to apply:** Any supplier category selector, filter, import, or report should read from the trade catalogue rather than location categories or free-text values.