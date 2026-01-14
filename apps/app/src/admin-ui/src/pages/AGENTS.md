# Admin UI Pages — Scoped AI Agent Guide

This file is a **scoped extension** of the root Nomos AI guide. Read the root guide first: [../../../../../../AGENTS.md](../../../../../../AGENTS.md).

## Mission for AI agents
- Keep admin UI **route-aligned** and predictable.
- Use the three-layer model: **Resource Definitions → Page Modules → Templates**.
- Prefer the lowest layer that satisfies the use case.

## Three-layer model (non-negotiable)
1. **Resource Definitions** — declarative CRUD configuration.
2. **Page Modules** — data/behavior contract (handwritten when needed).
3. **Templates** — rendering only; no business logic.

## How to choose the layer
- **Simple CRUD pages** → Resource definitions + `ResourceView` (no custom page module required).
- **Complex workflows** → Add a handwritten `*.page.ts` module (page module layer).
- **Fully custom rendering** → Add a template override (still driven by a page module).

## Page module guidance (what’s actually used)
- Handwritten page modules live in `pages/**/**.page.ts` and are resolved by `resolvePageModule`.
- Astro pages **do not** usually export page modules for CRUD routes; they render `ResourceView` with a definition.
- If you need page metadata (title, subtitle, actions) for a list page, you can export `pageModule` from `pages/<resource>/index.astro` as shown in existing routes.

## Anti-patterns (do not do this)
- Wrapper templates that only render an island.
- Bypassing resource definitions for CRUD.
- Splitting simple routes into multiple files without need.

## Minimal canonical example (CRUD route)
```astro
---
import AdminLayout from "../../layouts/AdminLayout.astro";
import ResourceView from "../../islands/ResourceView.svelte";
import { usersResource } from "./users.resource";
---
<AdminLayout title="Users">
  <ResourceView client:load definition={usersResource} view="List" />
</AdminLayout>
```

## Base-path principle
- UI routes **must not** bake in host mount paths (no `/admin/admin` logic).
- Keep routes portable and resolved by the router.

## Common pitfalls
- Mixing data loading into templates.
- Hard-coding API paths instead of using configured endpoints.
- Ignoring resource definitions for CRUD screens.

## Related guides
- Root guide: [../../../../../../AGENTS.md](../../../../../../AGENTS.md)
- Routes guidance: [../../../routes/AGENTS.md](../../../routes/AGENTS.md)
- Plugins guidance: [../../../plugins/AGENTS.md](../../../plugins/AGENTS.md)
