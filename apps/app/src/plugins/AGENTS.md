# Plugins — Scoped AI Agent Guide

This file is a **scoped extension** of the root Nomos AI guide. Read the root guide first: [../../../../AGENTS.md](../../../../AGENTS.md).

## Mission for AI agents
- Treat plugins as the **primary extension mechanism**.
- Prefer plugins over editing platform/core code.
- Keep behavior declarative and discoverable.

## What belongs in a plugin vs platform/core
**Put in a plugin when:**
- Adding app-specific resources, routes, templates, or admin UI overrides.
- Integrating third-party services.
- Providing optional features that should be enabled/disabled.

**Put in platform/core when:**
- Adding **new extension points** used by many plugins.
- Changing **shared contracts** (types, registries, resolution order).
- Fixing **cross-cutting bugs** that affect every app.

If a change can be a plugin, **it must be a plugin**. Escalate to platform only when the extension story is missing. See [../platform/AGENTS.md](../platform/AGENTS.md).

## Plugin coordination surfaces
**Platform capabilities**
- Use existing hooks/middleware/registries as defined by the platform.
- Never bypass registries or add parallel resolution layers.

**Routes (API)**
- Add endpoints via the route system with predictable tagging and auth/roles.
- Keep response shapes consistent with admin UI expectations.
- Coordinate with [../routes/AGENTS.md](../routes/AGENTS.md).

**Admin UI overrides**
- Prefer resource definitions and page modules; use template overrides sparingly.
- Respect the template override hierarchy; avoid duplicating defaults.

## Template override guidance
- ✅ Override templates to **customize rendering** only.
- ❌ Do **not** create wrapper templates that only render a single island.
- ✅ Keep templates dumb and free of business logic.

## Common pitfalls
- Hard-coding behavior that should be configurable via plugin options.
- Skipping resource definitions for CRUD.
- Hiding logic inside templates instead of page modules.
- Adding route handlers without auth/role expectations.

## Plugin author checklist
- **Naming & structure**
  - Use clear, stable plugin names and folder layout.
  - Keep code co-located: routes, resources, templates, docs.
- **Templates/components**
  - Place overrides where the platform expects them; do not wrap islands.
- **Admin resources**
  - Add resource definitions and page modules without forking core UI.
- **Docs for AI**
  - Add a plugin README that explains purpose, entry points, and extension surfaces.

## Related guides
- Root guide: [../../../../AGENTS.md](../../../../AGENTS.md)
- Platform guidance: [../platform/AGENTS.md](../platform/AGENTS.md)
- Routes guidance: [../routes/AGENTS.md](../routes/AGENTS.md)
