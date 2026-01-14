# Routes — Scoped AI Agent Guide

This file is a **scoped extension** of the root Nomos AI guide. Read the root guide first: [../../../../AGENTS.md](../../../../AGENTS.md).

## Mission for AI agents
- Keep API routes consistent, validated, and predictable.
- Preserve response contracts required by the admin UI and plugins.

## Route module conventions
- Define config/handlers with clear separation (validation, auth, handler).
- Provide tags/summary when the routing system supports it.
- Align naming with the resource/feature it serves.

## Response shape contracts (required)
- Success:
  - `{ ok: true, data, meta? }`
- Error:
  - `{ ok: false, error }`

## Validation expectations
- Use Zod for params, query, and body.
- Validate before handler execution.
- Keep errors consistent with the standard error shape.

## Guidance for plugin-provided routes
- Integrate with auth/roles in the same way as core routes.
- Use predictable naming and tagging conventions.
- Do not break admin UI assumptions about response shapes.
- Coordinate with [../plugins/AGENTS.md](../plugins/AGENTS.md).

## When adding a new resource (checklist)
- Add REST endpoints with consistent response shapes.
- Ensure auth/roles configuration is present.
- Add resource definition + pages in admin UI.
- Verify alignment with [../admin-ui/src/pages/AGENTS.md](../admin-ui/src/pages/AGENTS.md).

## Common pitfalls
- Skipping Zod validation for params or body.
- Returning ad-hoc response shapes.
- Forgetting auth/roles on new endpoints.

## Related guides
- Root guide: [../../../../AGENTS.md](../../../../AGENTS.md)
- Admin UI guidance: [../admin-ui/src/pages/AGENTS.md](../admin-ui/src/pages/AGENTS.md)
- Plugins guidance: [../plugins/AGENTS.md](../plugins/AGENTS.md)
