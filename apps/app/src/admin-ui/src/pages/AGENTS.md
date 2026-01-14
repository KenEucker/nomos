# Admin UI Pages — Scoped AI Agent Guide

This file is a **scoped extension** of the root Nomos AI guide. Read the root guide first: [../../../../../../AGENTS.md](../../../../../../AGENTS.md).

## Mission for AI agents
- Keep admin UI **route-aligned** and predictable.
- Use the three-layer model: **Astro route container + (page module / resource definition inputs)**; templates render only.
- Prefer the lowest layer that satisfies the use case.

## Three-layer model (non-negotiable)
1. **Astro route template** — required; defines the route and composes the page.
2. **Page module** — optional; per-route behavior contract (`<route>.page.ts`).
3. **Resource definition** — optional; per-resource defaults (`<name>.resource.ts`).

Notes:
- `.astro` files are required by Astro routing; keep them thin.
- `.page.ts` files are **optional** and apply to a single page only.
- `.resource.ts` files are **optional**, resource-wide, and not route-aware.

## ResourceView (renderer behavior)
- `ResourceView` is a **renderer/assembler**, not a router.
- It can render with minimal props; passing a `pageModule` prop is optional.
- Page module resolution can be automatic.

**View resolution priority** (effective view):
1. From the page module (if present)
2. Else from the resource definition (if present)
3. Else default to `List`

## How agents should reason about admin UI pages
- Add a **page module** only when a page needs custom behavior, data composition, or page-level actions.
- Add a **resource definition** when you want shared defaults across multiple pages for the same resource.
- A **simple `.astro` file** is sufficient when it only composes `AdminLayout` + `ResourceView`.

## Anti-patterns (do not do this)
- Wrapper templates that only render an island.
- Bypassing resource definitions when CRUD can be expressed there.
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
- The Astro app is mounted by Fastify at `/admin`; routes are defined **relative to the Astro root**.
- Do **not** create `src/pages/admin` or hardcode `/admin` into UI routes.

## Common pitfalls
- Mixing data loading into templates.
- Hard-coding API paths instead of using configured endpoints.
- Ignoring resource definitions for CRUD screens.

## Related guides
- Root guide: [../../../../../../AGENTS.md](../../../../../../AGENTS.md)
- Routes guidance: [../../../routes/AGENTS.md](../../../routes/AGENTS.md)
- Plugins guidance: [../../../plugins/AGENTS.md](../../../plugins/AGENTS.md)
