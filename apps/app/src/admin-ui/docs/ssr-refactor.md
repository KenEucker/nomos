# Admin UI SSR refactor audit

## Route classification

### SSR-suitable (lists, dashboards, read-only detail)
- `/admin` (dashboard)
- `/admin/users` (list)
- `/admin/users/[id]` (detail)
- `/admin/roles` (list)
- `/admin/roles/[id]` (detail)
- `/admin/sessions` (list)
- `/admin/sessions/[id]` (detail)
- `/admin/api-keys` (list)
- `/admin/jobs` (list)
- `/admin/audit` (list)
- `/admin/errors` (list)
- `/admin/routes` (list)
- `/admin/diagnostics` (list/metrics)
- `/admin/webhooks` (list)
- `/admin/docs` (read-only docs)

### Interactive-heavy (forms, rich inputs)
- `/admin/login`
- `/admin/users/new`
- `/admin/users/[id]/edit`
- `/admin/roles/new`
- `/admin/roles/[id]/edit`

## Conversion order (first pass)

1. `/admin/users` and `/admin/roles`
   - High-traffic list pages.
   - Establish SSR data-loading patterns and shared list scaffolding.
   - Easy to verify SSR output (table rows visible in view-source).

2. `/admin/sessions`, `/admin/api-keys`, `/admin/audit`
   - Similar list patterns; can reuse the same SSR table scaffold.

3. Detail views (`/admin/users/[id]`, `/admin/roles/[id]`, `/admin/sessions/[id]`)
   - Server-render primary fields; keep edit/inline actions as islands.

## client:load usage

- Before: 20 usages across `src/pages`
- After (this change set): 18 usages across `src/pages`
