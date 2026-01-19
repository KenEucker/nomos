# Platform — Scoped AI Agent Guide

This file is a **scoped extension** of the root Nomos AI guide. Read the root guide first: [../../../../AGENTS.md](../../../../AGENTS.md).

## Mission for AI agents
- Platform code defines **shared contracts** and **extension surfaces**.
- Prefer adding **extension points** over direct coupling.
- Preserve deterministic resolution order.

## What counts as platform work
- Registries and resolution order (resources/templates/panel modules).
- Shared types and contracts used across the app.
- Middleware/hook infrastructure used by plugins and routes.

## Extension-first rules
- Every new platform feature must expose a plugin extension story.
- Avoid parallel abstractions or hidden magic.
- Do not hard-wire behavior that should be configurable.

## Guidance for adding platform capabilities
**Registries & resolution**
- Keep resolution order predictable and documented.
- Do not add new registries that duplicate or undermine existing resolution concepts.

**Middleware/hooks**
- Provide composable hook APIs instead of hard-coded behavior.
- Keep hook signatures stable and typed.

**Shared types/contracts**
- Update contracts carefully; maintain backward compatibility where possible.
- Document expected shapes for admin UI and plugins.

## Common pitfalls
- Adding a new abstraction when an existing registry already fits.
- Hiding behavior in side effects instead of explicit hooks.
- Breaking deterministic resolution order.

## Platform change checklist
- What is the **extension story** for plugins? (documented?)
- Which **contracts** must remain stable?
- Which **docs** must be updated (root + scoped guides)?
- Did you preserve predictable resolution order?

## Related guides
- Root guide: [../../../../AGENTS.md](../../../../AGENTS.md)
- Plugins guidance: [../plugins/AGENTS.md](../plugins/AGENTS.md)
- Routes guidance: [../routes/AGENTS.md](../routes/AGENTS.md)
