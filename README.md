# Nomos

## V1 Steel Test

### Local setup

```bash
npm install
npm --prefix apps/app run prisma:migrate
npm --prefix apps/app run prisma:seed
npm run dev
```

### Demo credentials

- Admin: `admin@nomos.local` / `admin123`
- Editor: `editor@nomos.local` / `editor123`
- Viewer: `viewer@nomos.local` / `viewer123`

### What to try

- OpenAPI: http://localhost:3001/api/docs (GET `/api` redirects here)
- Auth:
  - POST `/api/auth/login`
  - GET `/api/auth/me`
- Projects & tasks:
  - GET `/api/projects`
  - GET `/api/tasks`
- Admin-only:
  - GET `/api/users`
  - PUT `/api/users/:id/roles`

### UI walkthrough

- Visit http://localhost:3001/login and sign in.
- Dashboard at `/` shows counts + recent tasks.
- Projects at `/projects` and detail at `/projects/:id`.
- Tasks at `/tasks/:id` include edit, comments, attachments.
- Users at `/users` (admin only) to manage roles.
