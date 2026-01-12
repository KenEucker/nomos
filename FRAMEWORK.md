# Nomos Framework - LLM Development Guide

**Version:** 0.1.0  
**Philosophy:** Convention-driven, declarative, LLM-friendly API development

## What is Nomos?

Nomos is a TypeScript framework for rapidly building production-ready APIs with admin interfaces. It combines Fastify's performance with Astro's file-based routing patterns, designed specifically for LLM-assisted development.

**Core Architecture:**
- **Backend:** Fastify + TypeScript
- **Admin UI:** Astro (server-rendered)
- **Plugin System:** File-based discovery with declarative exports
- **Single Port:** API (`/api/*`) and Admin (`/*`) served together
- **Auto-Generated:** Swagger docs at `/api/docs`
- **Built-in:** Authentication, users, roles, permissions

## Quick Mental Model

Think of Nomos as:
- **Laravel/Orchid** (declarative UI from code) + **Next.js** (file-based routing) + **Fastify** (performance)
- Each plugin is a self-contained feature module
- The filesystem defines your API structure
- TypeScript types become your documentation

---

## Plugin Anatomy

Every plugin lives in its own directory and exports a single `index.ts` with optional members:

```typescript
// plugins/my-feature/index.ts
export default {
  name: "my-feature",                    // Unique identifier
  permissions: [],                       // Array of permission strings
  routes: [],                            // Route configuration
  services: {},                          // Business logic layer
  adminResources: [],                    // Admin UI definitions
  nav: [],                               // Admin navigation items
  listeners: [],                         // Event handlers
  jobs: [],                              // Scheduled tasks
  events: [],                            // Event names this plugin emits
  setup: async (app) => {}              // One-time initialization
}
```

**All members are optional** - export only what you need.

---

## File Structure Convention

```
my-nomos-app/
├── apps/
│   └── app/
│       ├── src/
│       │   ├── platform/
│       │   │   └── createApp.ts       # Framework core
│       │   └── plugins/
│       │       ├── users/             # Built-in plugin
│       │       │   ├── index.ts       # Plugin export
│       │       │   ├── routes/        # API routes (file-based)
│       │       │   │   └── [id].ts    # Dynamic route param
│       │       │   ├── services/      # Business logic
│       │       │   └── resources/     # Admin UI definitions
│       │       └── my-feature/        # Your plugin
│       │           ├── index.ts
│       │           └── routes/
│       │               ├── index.ts   # GET/POST /api/my-feature
│       │               └── [id].ts    # GET/PUT/DELETE /api/my-feature/:id
│       └── admin/                     # Astro admin UI
└── package.json
```

---

## Creating Your First Plugin

### 1. Basic Plugin Structure

```typescript
// plugins/tasks/index.ts
import path from 'path';

export default {
  name: "tasks",
  
  // Define permissions for this feature
  permissions: [
    "tasks.read",
    "tasks.create",
    "tasks.update",
    "tasks.delete"
  ],
  
  // Point to your routes directory
  routes: [{
    baseDir: path.join(__dirname, "routes"),
    owner: "tasks"
  }],
  
  // Add to admin navigation
  nav: [{
    path: "/tasks",
    label: "Tasks"
  }],
  
  // Declare events this plugin emits
  events: [
    "tasks.created",
    "tasks.updated",
    "tasks.deleted"
  ]
}
```

### 2. File-Based Routes

Routes follow Astro's pattern - the filename determines the endpoint:

```typescript
// plugins/tasks/routes/index.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// Validation schema
const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['todo', 'in-progress', 'done']).default('todo')
});

export async function GET(request: FastifyRequest, reply: FastifyReply) {
  // GET /api/tasks
  const tasks = await request.server.services.tasks.list();
  return reply.send(tasks);
}

export async function POST(request: FastifyRequest, reply: FastifyReply) {
  // POST /api/tasks
  const data = createTaskSchema.parse(request.body);
  const task = await request.server.services.tasks.create(data);
  
  // Emit event for other plugins to react
  request.server.events.emit('tasks.created', task);
  
  return reply.code(201).send(task);
}
```

```typescript
// plugins/tasks/routes/[id].ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.string()
});

export async function GET(request: FastifyRequest, reply: FastifyReply) {
  // GET /api/tasks/:id
  const { id } = paramsSchema.parse(request.params);
  const task = await request.server.services.tasks.findById(id);
  
  if (!task) {
    return reply.code(404).send({ error: 'Task not found' });
  }
  
  return reply.send(task);
}

export async function PUT(request: FastifyRequest, reply: FastifyReply) {
  // PUT /api/tasks/:id
  const { id } = paramsSchema.parse(request.params);
  const task = await request.server.services.tasks.update(id, request.body);
  
  request.server.events.emit('tasks.updated', task);
  
  return reply.send(task);
}

export async function DELETE(request: FastifyRequest, reply: FastifyReply) {
  // DELETE /api/tasks/:id
  const { id } = paramsSchema.parse(request.params);
  await request.server.services.tasks.delete(id);
  
  request.server.events.emit('tasks.deleted', { id });
  
  return reply.code(204).send();
}
```

**Route File Naming:**
- `index.ts` → `/api/plugin-name`
- `[id].ts` → `/api/plugin-name/:id`
- `[slug].ts` → `/api/plugin-name/:slug`
- `nested/[id].ts` → `/api/plugin-name/nested/:id`

---

## Services Layer

Services contain your business logic and are injected into the Fastify instance:

```typescript
// plugins/tasks/services/tasksService.ts
export function createTasksService(db: any, hooks: any, events: any) {
  return {
    async list(filters = {}) {
      // Trigger before hook
      await hooks.execute('tasks.beforeList', filters);
      
      const tasks = await db.tasks.findMany({
        where: filters,
        orderBy: { createdAt: 'desc' }
      });
      
      // Trigger after hook
      await hooks.execute('tasks.afterList', tasks);
      
      return tasks;
    },
    
    async findById(id: string) {
      return db.tasks.findUnique({ where: { id } });
    },
    
    async create(data: any) {
      await hooks.execute('tasks.beforeCreate', data);
      
      const task = await db.tasks.create({ data });
      
      await hooks.execute('tasks.afterCreate', task);
      events.emit('tasks.created', task);
      
      return task;
    },
    
    async update(id: string, data: any) {
      const task = await db.tasks.update({
        where: { id },
        data
      });
      
      events.emit('tasks.updated', task);
      return task;
    },
    
    async delete(id: string) {
      await db.tasks.delete({ where: { id } });
      events.emit('tasks.deleted', { id });
    }
  };
}

// In your plugin index.ts:
export default {
  // ...
  services: {
    tasks: (db, hooks, events) => createTasksService(db, hooks, events)
  }
}
```

**Accessing Services:**
```typescript
// In any route handler:
request.server.services.tasks.list();
request.server.services.users.findById(userId);
```

---

## Events System

Plugins communicate through events (pub/sub pattern):

### Emitting Events

```typescript
// In your service or route:
request.server.events.emit('tasks.created', task);
request.server.events.emit('tasks.statusChanged', { 
  taskId: task.id, 
  oldStatus: 'todo', 
  newStatus: 'done' 
});
```

### Listening to Events

```typescript
// plugins/notifications/listeners/taskListener.ts
export const taskCreatedListener = {
  event: 'tasks.created',
  handler: async (task: any, context: any) => {
    // Send notification when task is created
    await context.services.notifications.send({
      type: 'task_created',
      userId: task.assignedTo,
      data: task
    });
  }
};

// In plugin index.ts:
export default {
  listeners: [taskCreatedListener]
}
```

---

## Hooks System

Hooks allow you to inject logic before/after service methods:

```typescript
// plugins/audit/hooks/taskHooks.ts
export const auditTaskHook = {
  name: 'audit-tasks',
  hooks: {
    'tasks.beforeCreate': async (data: any, context: any) => {
      console.log('Task about to be created:', data);
      // Add audit trail
      data.createdBy = context.currentUser.id;
    },
    'tasks.afterCreate': async (task: any, context: any) => {
      await context.services.audit.log({
        action: 'task.created',
        resourceId: task.id,
        userId: context.currentUser.id
      });
    }
  }
};
```

---

## Jobs (Scheduled Tasks)

```typescript
// plugins/tasks/jobs/reminderJob.ts
export const taskReminderJob = {
  name: 'task-reminders',
  schedule: '0 9 * * *', // Every day at 9am (cron syntax)
  handler: async (context: any) => {
    const dueTasks = await context.services.tasks.findDueToday();
    
    for (const task of dueTasks) {
      await context.services.notifications.send({
        type: 'task_reminder',
        userId: task.assignedTo,
        data: task
      });
    }
  }
};

// In plugin index.ts:
export default {
  jobs: [taskReminderJob]
}
```

---

## Admin Resources

Define CRUD interfaces declaratively (inspired by Laravel Orchid):

```typescript
// plugins/tasks/resources/taskResource.ts
export const taskResource = {
  name: 'tasks',
  label: 'Tasks',
  icon: 'checkbox',
  
  // List view configuration
  list: {
    columns: [
      { field: 'title', label: 'Title', sortable: true },
      { field: 'status', label: 'Status', type: 'badge' },
      { field: 'assignedTo', label: 'Assigned To', type: 'user' },
      { field: 'dueDate', label: 'Due Date', type: 'date' }
    ],
    filters: [
      { field: 'status', type: 'select', options: ['todo', 'in-progress', 'done'] },
      { field: 'assignedTo', type: 'user-select' }
    ],
    actions: ['create', 'edit', 'delete']
  },
  
  // Create/Edit form configuration
  form: {
    fields: [
      { 
        name: 'title', 
        label: 'Title', 
        type: 'text', 
        required: true,
        validation: 'min:3|max:255'
      },
      { 
        name: 'description', 
        label: 'Description', 
        type: 'textarea',
        rows: 5
      },
      { 
        name: 'status', 
        label: 'Status', 
        type: 'select',
        options: [
          { value: 'todo', label: 'To Do' },
          { value: 'in-progress', label: 'In Progress' },
          { value: 'done', label: 'Done' }
        ],
        default: 'todo'
      },
      { 
        name: 'assignedTo', 
        label: 'Assigned To', 
        type: 'user-select'
      },
      { 
        name: 'dueDate', 
        label: 'Due Date', 
        type: 'date'
      },
      {
        name: 'tags',
        label: 'Tags',
        type: 'multi-select',
        options: ['urgent', 'bug', 'feature', 'enhancement']
      }
    ]
  },
  
  // Detail view configuration
  detail: {
    sections: [
      {
        title: 'Task Information',
        fields: ['title', 'description', 'status']
      },
      {
        title: 'Assignment',
        fields: ['assignedTo', 'dueDate']
      }
    ]
  }
};

// In plugin index.ts:
export default {
  adminResources: [taskResource]
}
```

---

## Setup Hook (One-Time Initialization)

```typescript
// plugins/tasks/index.ts
export default {
  // ...
  setup: async (app: any) => {
    // Run migrations
    await app.db.schema.createTableIfNotExists('tasks', (table) => {
      table.uuid('id').primary();
      table.string('title').notNullable();
      table.text('description');
      table.enum('status', ['todo', 'in-progress', 'done']).default('todo');
      table.uuid('assignedTo').references('users.id');
      table.date('dueDate');
      table.timestamps();
    });
    
    // Seed initial data if needed
    const count = await app.db.tasks.count();
    if (count === 0) {
      await app.db.tasks.create({
        title: 'Welcome to Nomos!',
        description: 'This is your first task',
        status: 'todo'
      });
    }
    
    console.log('Tasks plugin initialized');
  }
}
```

---

## Authentication & Permissions

Routes automatically check permissions if specified:

```typescript
// plugins/tasks/routes/index.ts
export const config = {
  permissions: ['tasks.read'] // User must have this permission
};

export async function GET(request: FastifyRequest, reply: FastifyReply) {
  // If user doesn't have 'tasks.read', they get 403 before this runs
  const tasks = await request.server.services.tasks.list();
  return reply.send(tasks);
}
```

**Accessing current user:**
```typescript
export async function POST(request: FastifyRequest, reply: FastifyReply) {
  const currentUser = request.user; // Injected by auth middleware
  
  const task = await request.server.services.tasks.create({
    ...request.body,
    createdBy: currentUser.id
  });
  
  return reply.send(task);
}
```

---

## Inter-Plugin Communication

### Option 1: Events (Loose Coupling)
```typescript
// Plugin A emits
request.server.events.emit('order.placed', order);

// Plugin B listens
export const orderListener = {
  event: 'order.placed',
  handler: async (order, context) => {
    await context.services.inventory.decreaseStock(order.items);
  }
};
```

### Option 2: Services (Direct Calls)
```typescript
// Any plugin can call any service
await request.server.services.users.findById(userId);
await request.server.services.notifications.send(notification);
```

### Option 3: Hooks (Modify Behavior)
```typescript
// Plugin B can modify Plugin A's behavior
export const enrichmentHook = {
  hooks: {
    'tasks.afterCreate': async (task, context) => {
      task.metadata = await context.services.external.fetchMetadata(task.id);
      return task;
    }
  }
};
```

---

## Common Patterns

### Pattern 1: CRUD Plugin

```typescript
// Minimal CRUD setup
export default {
  name: "products",
  permissions: ["products.read", "products.write"],
  routes: [{ baseDir: path.join(__dirname, "routes"), owner: "products" }],
  services: {
    products: (db) => ({
      list: () => db.products.findMany(),
      findById: (id) => db.products.findUnique({ where: { id } }),
      create: (data) => db.products.create({ data }),
      update: (id, data) => db.products.update({ where: { id }, data }),
      delete: (id) => db.products.delete({ where: { id } })
    })
  },
  adminResources: [productResource],
  nav: [{ path: "/products", label: "Products" }]
}
```

### Pattern 2: Event-Driven Plugin

```typescript
// Plugin that only reacts to events
export default {
  name: "notifications",
  listeners: [
    {
      event: 'user.created',
      handler: async (user, ctx) => {
        await ctx.services.email.sendWelcome(user.email);
      }
    },
    {
      event: 'order.placed',
      handler: async (order, ctx) => {
        await ctx.services.sms.send(order.phone, 'Order confirmed!');
      }
    }
  ]
}
```

### Pattern 3: Background Processing

```typescript
// Plugin with scheduled jobs
export default {
  name: "reports",
  jobs: [
    {
      name: 'daily-report',
      schedule: '0 0 * * *', // Midnight daily
      handler: async (ctx) => {
        const data = await ctx.services.analytics.getDailyMetrics();
        await ctx.services.reports.generate('daily', data);
      }
    }
  ]
}
```

---

## TypeScript Tips for LLMs

### 1. Use Explicit Types
```typescript
// Good - clear types
interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  dueDate?: Date;
}

export async function create(data: Omit<Task, 'id'>): Promise<Task> {
  // ...
}

// Avoid - implicit any
export async function create(data) {
  // ...
}
```

### 2. Use Zod for Validation
```typescript
import { z } from 'zod';

const taskSchema = z.object({
  title: z.string().min(1).max(255),
  status: z.enum(['todo', 'in-progress', 'done']),
  dueDate: z.date().optional()
});

// Type is automatically inferred
type Task = z.infer<typeof taskSchema>;
```

### 3. Export Types for Reuse
```typescript
// plugins/tasks/types.ts
export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
}

export type TaskStatus = 'todo' | 'in-progress' | 'done';

export type CreateTaskInput = Omit<Task, 'id'>;
export type UpdateTaskInput = Partial<CreateTaskInput>;
```

---

## Testing Plugins

```typescript
// plugins/tasks/tests/tasks.test.ts
import { createApp } from '../../platform/createApp';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Tasks Plugin', () => {
  let app: any;
  
  beforeAll(async () => {
    app = await createApp({ env: 'test' });
    await app.ready();
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  it('should create a task', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        title: 'Test Task',
        status: 'todo'
      }
    });
    
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      title: 'Test Task',
      status: 'todo'
    });
  });
  
  it('should list tasks', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks'
    });
    
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
  });
});
```

---

## Best Practices for LLM Development

### 1. One Concept Per File
```
✅ Good:
plugins/tasks/services/taskService.ts
plugins/tasks/services/taskValidator.ts
plugins/tasks/services/taskNotifier.ts

❌ Avoid:
plugins/tasks/services/everything.ts
```

### 2. Explicit Over Implicit
```typescript
// ✅ Good - clear intent
export const config = {
  permissions: ['tasks.read'],
  rateLimit: { max: 100, timeWindow: '1 minute' }
};

// ❌ Avoid - magic behavior
export const config = {};
```

### 3. Self-Documenting Names
```typescript
// ✅ Good
async function sendTaskReminderToAssignedUser(task: Task) {}

// ❌ Avoid
async function send(t: any) {}
```

### 4. Complete Examples in Comments
```typescript
/**
 * Creates a new task with optional notifications
 * 
 * @example
 * ```typescript
 * const task = await services.tasks.create({
 *   title: 'Review PR',
 *   assignedTo: 'user-123',
 *   notify: true
 * });
 * ```
 */
async function create(data: CreateTaskInput) {}
```

---

## Error Handling

```typescript
// Use standard HTTP error codes
export async function GET(request: FastifyRequest, reply: FastifyReply) {
  try {
    const task = await request.server.services.tasks.findById(request.params.id);
    
    if (!task) {
      return reply.code(404).send({ 
        error: 'Not Found',
        message: 'Task not found' 
      });
    }
    
    return reply.send(task);
    
  } catch (error) {
    request.log.error(error);
    
    // Zod validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ 
        error: 'Validation Error',
        details: error.errors 
      });
    }
    
    // Generic server error
    return reply.code(500).send({ 
      error: 'Internal Server Error',
      message: 'An unexpected error occurred' 
    });
  }
}
```

---

## Environment Configuration

```typescript
// config/default.ts
export default {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0'
  },
  database: {
    url: process.env.DATABASE_URL
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiration: '7d'
  },
  // Plugin-specific config
  plugins: {
    tasks: {
      reminderTime: '09:00',
      maxTasksPerUser: 100
    }
  }
};

// Access in plugin:
export async function POST(request: FastifyRequest, reply: FastifyReply) {
  const config = request.server.config.plugins.tasks;
  // ...
}
```

---

## Migration Guide from Express/NestJS

### Express → Nomos
```typescript
// Express
app.get('/api/tasks', async (req, res) => {
  const tasks = await Task.find();
  res.json(tasks);
});

// Nomos
// plugins/tasks/routes/index.ts
export async function GET(request: FastifyRequest, reply: FastifyReply) {
  const tasks = await request.server.services.tasks.list();
  return reply.send(tasks);
}
```

### NestJS → Nomos
```typescript
// NestJS
@Controller('tasks')
export class TasksController {
  @Get()
  async findAll() {
    return this.tasksService.findAll();
  }
}

// Nomos
// plugins/tasks/routes/index.ts
export async function GET(request: FastifyRequest, reply: FastifyReply) {
  const tasks = await request.server.services.tasks.list();
  return reply.send(tasks);
}
```

---

## Debugging Tips

### 1. Enable Detailed Logging
```typescript
// In your plugin
request.log.debug('Fetching tasks with filters:', filters);
request.log.info('Task created:', task);
request.log.warn('Performance slow:', { duration });
request.log.error('Failed to create task:', error);
```

### 2. Use the Built-in Request Logger
```typescript
export async function POST(request: FastifyRequest, reply: FastifyReply) {
  request.log.info({ body: request.body }, 'Incoming request');
  // ...
}
```

### 3. Inspect Plugin Loading
```bash
# Set environment variable for verbose plugin loading
DEBUG=nomos:plugins npm run dev
```

---

## Performance Optimization

### 1. Use Async Iterators for Large Datasets
```typescript
async function* streamTasks() {
  const batchSize = 100;
  let offset = 0;
  
  while (true) {
    const tasks = await db.tasks.findMany({
      skip: offset,
      take: batchSize
    });
    
    if (tasks.length === 0) break;
    
    for (const task of tasks) {
      yield task;
    }
    
    offset += batchSize;
  }
}
```

### 2. Cache Service Results
```typescript
services: {
  tasks: (db, hooks, events) => {
    const cache = new Map();
    
    return {
      async list() {
        if (cache.has('all')) {
          return cache.get('all');
        }
        
        const tasks = await db.tasks.findMany();
        cache.set('all', tasks);
        
        return tasks;
      }
    };
  }
}
```

---

## Security Checklist

- [ ] All routes have appropriate permission checks
- [ ] Input validation using Zod on all routes
- [ ] SQL injection prevention (use parameterized queries)
- [ ] XSS prevention (sanitize user input in admin UI)
- [ ] CSRF tokens on admin forms
- [ ] Rate limiting on public endpoints
- [ ] Audit logging for sensitive operations
- [ ] Environment variables for secrets (never commit)

---

## What Makes This LLM-Friendly?

1. **Convention over Configuration:** File location = route path
2. **Declarative Patterns:** Export an object, we handle the rest
3. **Explicit Types:** TypeScript everywhere = clear contracts
4. **Self-Documenting:** Plugin structure shows what it does
5. **Complete Examples:** Every concept demonstrated in full
6. **Predictable Patterns:** One way to do things
7. **Minimal Boilerplate:** Focus on business logic
8. **Clear Boundaries:** Routes, services, events are separate concerns

---

## Next Steps for Developers

1. ✅ Read this document
2. ✅ Examine the built-in `users` plugin as a reference
3. ✅ Start with a simple CRUD plugin
4. ✅ Add event listeners to react to other plugins
5. ✅ Create admin resources for UI management
6. ✅ Add scheduled jobs if needed
7. ✅ Write tests for your plugin
8. ✅ Deploy to production

---

## LLM Prompt Template for Plugin Generation

```
I need a Nomos plugin called {PLUGIN_NAME} that handles {DESCRIPTION}.

Requirements:
- CRUD operations for {RESOURCE}
- Permissions: {PERMISSION_LIST}
- Admin UI with {FIELD_LIST}
- Events: {EVENT_LIST}
- {ADDITIONAL_REQUIREMENTS}

Please generate:
1. Plugin index.ts with all exports
2. Route handlers (index.ts and [id].ts)
3. Service implementation
4. Admin resource definition
5. TypeScript interfaces
6. Validation schemas

Use the Nomos framework conventions from FRAMEWORK.md.
```

---

## Reference: Built-in Plugins

### Users Plugin
- **Routes:** `/api/users`, `/api/users/:id`
- **Permissions:** `users.read`, `users.create`, `users.update`, `users.delete`
- **Events:** `users.created`, `users.updated`, `users.deleted`
- **Admin Resource:** User management with roles

### Auth Plugin
- **Routes:** `/api/auth/login`, `/api/auth/logout`, `/api/auth/register`
- **Permissions:** `auth.manage`
- **Services:** JWT token generation, password hashing

---

## FAQ for LLMs

**Q: How do I access the database?**
A: Use `request.server.db` in routes or receive it as parameter in services.

**Q: How do I access other services?**
A: Use `request.server.services.{serviceName}` in routes or receive context in listeners/hooks.

**Q: How do routes get registered?**
A: Export `GET`, `POST`, `PUT`, `DELETE`, `PATCH` functions from files in your `routes/` directory.

**Q: Do I need to manually register my plugin?**
A: No, plugins are auto-discovered from the `plugins/` directory.

**Q: How do I share code between plugins?**
A: Create a `shared/` directory or use the event system for loose coupling.

**Q: Can plugins depend on other plugins?**
A: Yes, through events (loose) or direct service calls (tight). Events are preferred.

**Q: How do I add custom middleware?**
A: Use the `setup` hook in your plugin to register Fastify middleware.

---

## Version History

- **0.1.0** - Initial framework guide (January 2026)

---

**Remember:** The goal is rapid development with LLM assistance. Keep patterns simple, predictable, and well-documented. When in doubt, look at the `users` plugin as the reference implementation.
