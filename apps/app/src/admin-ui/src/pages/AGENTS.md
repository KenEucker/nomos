# Admin UI Pages — Scoped AI Agent Guide

This file is a **scoped extension** of the root Nomos AI guide. Read the root guide first: [../../../../../../AGENTS.md](../../../../../../AGENTS.md).

## Mission for AI agents
- Keep admin UI **route-aligned** and predictable.
- Use the three-layer model: **Resource Definitions → Page Modules → Templates**.
- Prefer the lowest layer possible.

## Page module paradigm
- **Simple pages:** export `pageModule` directly from the route `.astro` file.
- **Complex pages:** create a route-aligned `*.page.ts` module.
- Do not split simple CRUD into separate `List.ts` / `Detail.ts` files.

## Three-layer model (non-negotiable)
1. **Resource Definitions** — declarative CRUD configuration.
2. **Page Modules** — data/behavior contract.
3. **Templates** — rendering only; no business logic.

## Anti-patterns (do not do this)
- Wrapper templates that only render an island.
- Bypassing resource definitions for CRUD.
- Splitting simple routes into multiple files without need.

## Minimal canonical example (tiny snippet)
```astro
---
import ResourceView from "@admin-ui/components/ResourceView.astro";
import { usersResource } from "./users.resource";
export const pageModule = usersResource;
---
<ResourceView />
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
