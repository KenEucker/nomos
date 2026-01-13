# AI Contract - Nomos Framework

**This repository is designed to be LLM-legible.** This contract defines the conventions and patterns that make Nomos easy for AI assistants to understand and extend.

---

## 🎯 Core Philosophy

Nomos follows these principles to maximize LLM comprehension:
- **Convention over Configuration**: File paths determine behavior
- **Declarative over Imperative**: Export objects, not procedures
- **Explicit over Implicit**: Types and structure are always visible
- **Predictable over Clever**: One obvious way to do things

---

## 📁 File Structure Contract

### Route Discovery
**Contract**: Routes are discovered automatically from the filesystem. No manual registration required.

```
apps/app/src/
├── routes/**            # Global API routes (served under /api)
│   └── health.ts        # → GET /api/health
└── plugins/
    └── tasks/
        └── routes/
            ├── index.ts     # → GET|POST /api/tasks
            └── [id].ts      # → GET|PUT|DELETE /api/tasks/:id
```

**Route Module Pattern**:
```typescript
// Export HTTP method handlers
export async function GET(ctx: RouteContext) { ... }
export async function POST(ctx: RouteContext) { ... }

// Optional: Export route configuration
export const config = {
  auth: 'required',           // 'required' | 'optional' | 'none'
  permissions: ['tasks.read'],
  rateLimit: { max: 100, timeWindow: '1m' }
};
```

**⚠️ Never do this in route files**:
```typescript
// ❌ WRONG - No app.get() in route files
app.get('/api/tasks', handler);

// ✅ CORRECT - Export handler
export async function GET(ctx) { ... }
```

---

## 🔌 Plugin Contract

**Contract**: Plugins are self-contained feature modules that live in `apps/app/src/plugins/<name>/`.

### Plugin Structure
```
plugins/
└── tasks/
    ├── index.ts              # Plugin export (required)
    ├── routes/               # API routes (optional)
    │   ├── index.ts
    │   └── [id].ts
    ├── services/             # Business logic (optional)
    │   └── taskService.ts
    ├── resources/            # Admin UI config (optional)
    │   └── taskResource.ts
    ├── listeners/            # Event handlers (optional)
    │   └── taskListener.ts
    ├── jobs/                 # Scheduled tasks (optional)
    │   └── reminderJob.ts
    └── types.ts              # TypeScript types (optional)
```

### Plugin Export Pattern
```typescript
// plugins/tasks/index.ts
export default {
  name: "tasks",                                    // Unique identifier
  permissions: ["tasks.read", "tasks.create"],      // Permission strings
  routes: [{ baseDir: __dirname + "/routes" }],     // Route discovery
  services: {                                       // Business logic
    tasks: (db, hooks, events) => createTasksService(db, hooks, events)
  },
  adminResources: [taskResource],                   // Admin UI config
  nav: [{ path: "/tasks", label: "Tasks" }],       // Admin nav items
  listeners: [taskCreatedListener],                 // Event handlers
  jobs: [reminderJob],                              // Cron jobs
  events: ["tasks.created", "tasks.updated"],       // Event names
  setup: async (app) => { /* one-time init */ }    // Setup hook
};
```

**All members are optional** - export only what your plugin needs.

---

## 🔐 Auth & Permissions Contract

**Contract**: Authentication and authorization are handled declaratively in route config.

### Route-Level Auth
```typescript
export const config = {
  auth: 'required',                    // User must be authenticated
  permissions: ['tasks.read']          // User must have this permission
};

export async function GET(ctx: RouteContext) {
  // ctx.user is guaranteed to exist and have 'tasks.read' permission
  const currentUser = ctx.user;
}
```

### Auth Modes
- **`required`**: User must be authenticated (401 if not, 403 if missing permissions)
- **`optional`**: User may be authenticated (`ctx.user` might be null)
- **`none`**: No auth check (public endpoint)

### Development Auth
**Contract**: In development only, `POST /auth/dev/token` issues test JWTs.

```bash
# Development only (requires DEV_AUTH_SECRET env var)
curl -X POST http://localhost:3000/auth/dev/token \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "permissions": ["tasks.read", "tasks.write"]}'
```

**This endpoint is automatically disabled in production.**

---

## 📝 Context Object Contract

**Contract**: Route handlers receive a stable `ctx` object with request data and helpers.

```typescript
interface RouteContext {
  // Request data (pre-parsed and validated)
  params: Record<string, string>;      // URL params: /api/tasks/:id
  query: Record<string, any>;          // Query string: ?status=done
  body: any;                           // Request body (parsed JSON)
  headers: Record<string, string>;     // Request headers
  
  // Auth context
  user: User | null;                   // Current user (if authenticated)
  permissions: string[];               // User's permissions
  
  // Services
  services: {                          // Access all plugin services
    tasks: TaskService;
    users: UserService;
    // ... all registered services
  };
  
  // Response helpers
  send(data: any, status?: number): void;
  json(data: any, status?: number): void;
  error(message: string, status?: number): void;
  
  // Logging
  log: Logger;                         // Request-scoped logger with reqId
  
  // Events
  emit(event: string, data: any): void;
}
```

**Example Usage**:
```typescript
export async function POST(ctx: RouteContext) {
  // Validation already done - body is typed and safe
  const task = await ctx.services.tasks.create(ctx.body);
  
  // Emit event for other plugins
  ctx.emit('tasks.created', task);
  
  // Log with request context
  ctx.log.info({ taskId: task.id }, 'Task created');
  
  // Send response
  ctx.send(task, 201);
}
```

---

## ✅ Validation Contract

**Contract**: Validation is declared in route config using Zod schemas. Parsing happens once in the adapter.

```typescript
import { z } from 'zod';

// Define schema
const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  status: z.enum(['todo', 'in-progress', 'done']).default('todo'),
  dueDate: z.string().datetime().optional()
});

// Export in config
export const config = {
  validation: {
    body: createTaskSchema
  }
};

// Handler receives validated data
export async function POST(ctx: RouteContext) {
  // ctx.body is already validated and typed as z.infer<typeof createTaskSchema>
  const task = await ctx.services.tasks.create(ctx.body);
  ctx.send(task, 201);
}
```

### Validation Errors
**Contract**: Validation errors follow a normalized format:

```json
{
  "error": "validation_error",
  "issues": [
    {
      "path": ["title"],
      "message": "String must contain at least 1 character(s)",
      "code": "too_small"
    }
  ]
}
```

---

## 🎪 Events & Listeners Contract

**Contract**: Events enable loose inter-plugin communication. Events are emitted and handled asynchronously.

### Declaring Events
```typescript
// In plugin export
export default {
  events: [
    "tasks.created",
    "tasks.updated", 
    "tasks.deleted"
  ]
};
```

### Emitting Events
```typescript
// In route handler
export async function POST(ctx: RouteContext) {
  const task = await ctx.services.tasks.create(ctx.body);
  ctx.emit('tasks.created', task);
  ctx.send(task, 201);
}

// Or in service
events.emit('tasks.statusChanged', { taskId, oldStatus, newStatus });
```

### Listening to Events
```typescript
// plugins/notifications/listeners/taskListener.ts
export const taskCreatedListener = {
  event: 'tasks.created',
  handler: async (task: Task, context: any) => {
    await context.services.notifications.send({
      type: 'task_created',
      userId: task.assignedTo,
      data: task
    });
  }
};

// Register in plugin export
export default {
  listeners: [taskCreatedListener]
};
```

**Contract**: All listeners are async and receive (eventData, context).

---

## ⏰ Jobs Contract

**Contract**: Jobs are scheduled tasks defined with cron expressions.

```typescript
// plugins/tasks/jobs/reminderJob.ts
export const taskReminderJob = {
  name: 'task-reminders',
  schedule: '0 9 * * *',              // Cron: Every day at 9am
  handler: async (context: any) => {
    const dueTasks = await context.services.tasks.findDueToday();
    
    for (const task of dueTasks) {
      context.emit('task.reminder', task);
    }
  }
};

// Register in plugin export
export default {
  jobs: [taskReminderJob]
};
```

---

## 🎨 Admin UI Contract

**Contract**: Admin resources define CRUD interfaces declaratively without writing component code.

```typescript
// plugins/tasks/resources/taskResource.ts
export const taskResource = {
  name: 'tasks',
  label: 'Tasks',
  icon: 'checkbox',
  
  list: {
    columns: [
      { field: 'title', label: 'Title', sortable: true },
      { field: 'status', label: 'Status', type: 'badge' }
    ],
    filters: [
      { field: 'status', type: 'select', options: ['todo', 'in-progress', 'done'] }
    ]
  },
  
  form: {
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'status', label: 'Status', type: 'select', options: [...] }
    ]
  }
};
```

### Admin Architecture
- **Frontend**: Astro + Svelte app served from `/`
- **Admin API**: JSON endpoints at `/admin/api/*`
- **Product API**: Public/protected API at `/api/*`
- **Single deployable**: Both UIs bundled together

---

## 📊 Logging Contract

**Contract**: Use structured logging with request context. Never use `console.log`.

### Logging Hierarchy
```typescript
// Application-level logging
app.log.info('Application started');
app.log.error({ err }, 'Fatal error');

// Subsystem logging
const subsystemLog = app.log.child({ domain: 'auth' });
subsystemLog.debug('Token validated');

// Request-scoped logging (preferred in routes)
export async function GET(ctx: RouteContext) {
  ctx.log.info({ taskId: '123' }, 'Fetching task');
  // Automatically includes: reqId, routeId, userId
}
```

### Log Levels & Configuration
**Environment Variables**:
- `LOG_LEVEL`: `trace` | `debug` | `info` | `warn` | `error` (default: `info`)
- `LOG_PRETTY`: `true` | `false` (pretty print for dev, JSON for prod)
- `LOG_DOMAINS`: Comma-separated domains to log (e.g., `auth,tasks`)
- `LOG_ERROR_STACK`: Include stack traces (default: `false` in prod)

### Request Logging
**Contract**: Every request generates these logs automatically:
- Request start: `{ reqId, method, url, ip }`
- Request end: `{ reqId, status, duration }`
- Auth events: `{ reqId, userId, event: 'auth.success|auth.failure' }`

---

## 🔍 Diagnostics Contract

**Contract**: Diagnostic endpoints provide system introspection.

### Public Endpoints (No Auth)
- `GET /health` - Health check (returns 200 if healthy)
- `GET /ready` - Readiness check (returns 200 if ready)
- `GET /version` - Version info

### Admin Endpoints (Auth Required)
- `GET /admin/api/diagnostics/routes` - List all registered routes
- `GET /admin/api/diagnostics/services` - List all services
- `GET /admin/api/diagnostics/events` - List all events
- `GET /admin/api/diagnostics/jobs` - List all scheduled jobs

**Production**: Admin diagnostics are disabled by default in production. Set `ENABLE_DIAGNOSTICS=true` to enable.

### Debugging Missing Routes
```bash
# Check what routes are registered
curl http://localhost:3000/admin/api/diagnostics/routes | jq

# Look for your route in the output
# Common issues:
# - File not in routes/ or plugins/*/routes/
# - Missing export function (GET, POST, etc.)
# - Plugin not registered (check plugins/ directory)
```

---

## 🚀 Service Contract

**Contract**: Services contain business logic and are injected into routes and listeners.

### Service Creation
```typescript
// plugins/tasks/services/taskService.ts
export function createTaskService(db: any, hooks: any, events: any) {
  return {
    async list(filters = {}) {
      await hooks.execute('tasks.beforeList', filters);
      const tasks = await db.tasks.findMany({ where: filters });
      await hooks.execute('tasks.afterList', tasks);
      return tasks;
    },
    
    async create(data: any) {
      await hooks.execute('tasks.beforeCreate', data);
      const task = await db.tasks.create({ data });
      await hooks.execute('tasks.afterCreate', task);
      events.emit('tasks.created', task);
      return task;
    }
  };
}

// Register in plugin
export default {
  services: {
    tasks: (db, hooks, events) => createTaskService(db, hooks, events)
  }
};
```

### Service Access
```typescript
// In route handler
ctx.services.tasks.list();

// In listener
context.services.tasks.findById(id);

// In job
context.services.tasks.findDueToday();
```

---

## ⚡ Error Handling Contract

**Contract**: Use HTTP status codes correctly and return normalized error responses.

### Standard Error Format
```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "details": { /* optional additional context */ }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `204` - No Content (successful delete)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (missing permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

### Error Handling Pattern
```typescript
export async function GET(ctx: RouteContext) {
  try {
    const task = await ctx.services.tasks.findById(ctx.params.id);
    
    if (!task) {
      return ctx.error('Task not found', 404);
    }
    
    ctx.send(task);
    
  } catch (err) {
    ctx.log.error({ err }, 'Failed to fetch task');
    ctx.error('Internal server error', 500);
  }
}
```

---

## 🧪 Testing Contract

**Contract**: Tests follow the same conventions as application code.

```typescript
// plugins/tasks/tests/tasks.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../platform/createApp';

describe('Tasks Plugin', () => {
  let app: any;
  
  beforeAll(async () => {
    app = await createApp({ env: 'test' });
    await app.ready();
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  it('creates a task', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Test Task' }
    });
    
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ title: 'Test Task' });
  });
});
```

---

## 🎓 LLM Development Guidelines

### When Building Plugins:

1. **Start with the plugin export** - Define what your plugin provides
2. **Create route files** - One file per endpoint group
3. **Define Zod schemas** - Validation first
4. **Implement services** - Business logic separate from routes
5. **Add admin resources** - If UI is needed
6. **Emit events** - For extensibility
7. **Write tests** - Validate behavior

### Common Patterns:

**CRUD Plugin** = Routes + Service + Admin Resource + Permissions
**Background Worker** = Listeners + Jobs
**Integration** = Service + Events + External API calls
**Admin Feature** = Admin Resource only (no public API)

### Anti-Patterns to Avoid:

❌ `app.get()` calls in route files
❌ `any` types in public APIs  
❌ Direct database access in routes
❌ `console.log` for logging
❌ Hard-coded configuration
❌ Tight coupling between plugins

---

## 📚 Reference Documentation

For detailed information, see:
- **FRAMEWORK.md** - Comprehensive framework guide with examples
- **PLUGIN_GENERATION_PROMPTS.md** - Standardized prompts for consistent code generation
- **EVALUATION_CHECKLIST.md** - Quality assessment for LLM-friendliness
- **apps/app/src/platform/** - Core registry types and adapters

---

## 🔄 Contract Evolution

This contract is designed to evolve. When adding new conventions:

1. **Document the pattern** - Add to this contract
2. **Provide examples** - Show complete working code
3. **Update FRAMEWORK.md** - Expand with details
4. **Test with LLMs** - Verify they understand it
5. **Iterate** - Refine based on feedback

**Version**: 1.0.0 (January 2026)

---

**Remember**: This contract exists to make Nomos predictable for both humans and LLMs. Clarity and consistency over cleverness.
