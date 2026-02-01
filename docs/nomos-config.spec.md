# Nomos Configuration Specification

**Status:** Active Draft

**Version:** 0.1.2

**Audience:** Framework users, platform contributors, operators

**Scope:** Defines the Nomos project configuration file (`nomos.config.*`), resolution rules, normalization, and defaults

---

## 1. Overview

Nomos supports a first-class project configuration file located at the **project root**.

This configuration controls:

* platform modules and built-ins
* plugin discovery and plugin manager behavior
* database provider selection and connection details
* runtime/environmental defaults and overrides
* API-level settings (rate limiting, CORS, etc.)

Nomos configuration is **explicit**, **normalized**, and **deterministic**.

> This configuration file is for **runtime behavior**.
>
> **Tooling behavior** (e.g. project scaffolding, vendor-import syncing) is generally out of scope, but this spec includes a small, explicit section describing how tooling may reference config **without changing runtime semantics**.

---

## 2. Configuration File Resolution

Nomos resolves configuration in the following priority order and loads the **first file found**:

1. `nomos.config.ts`
2. `nomos.config.mjs`
3. `nomos.config.js`

If no config file exists, Nomos uses platform defaults.

> This resolution order is canonical. Do not attempt to merge multiple config files.

---

## 3. Configuration Shape (High-Level)

A Nomos config is a single exported object.

At a minimum, config commonly includes:

* `modules` — built-in modules and feature toggles
* `plugins` / `pluginManager` — plugin discovery and governance
* `database` — database provider and connection configuration
* `api` — API-level settings (rate limiting, CORS)
* `runtime` — environment and server-level settings
* `observability` — telemetry toggles and sinks (high-level hooks)

Nomos may support additional keys over time, but all keys must be validated and unknown keys should produce diagnostics.

---

## 4. Modules

### 4.1 Module Enablement

Built-in modules may be enabled/disabled via the `modules` section.

Modules support a boolean shorthand form:

* `true` → `{ enabled: true }`
* `false` → `{ enabled: false }`

Example:

```ts
modules: {
  auth: true,
  admin: false,
  docs: { enabled: true }
}
```

### 4.2 Normalization Rule

Before runtime boot, Nomos normalizes module entries so that **every module is an object** of the form:

```ts
{ enabled: boolean, ...moduleOptions }
```

This guarantees deterministic downstream behavior.

### 4.3 Admin Module UI Source (Optional)

Nomos ships with a built-in admin UI. Some development flows use a **vendor-import** approach to keep the admin runtime synchronized with an upstream reference UI.

This is **optional** and does not affect the runtime module contract beyond providing a declarative place to express intent.

Suggested shape:

```ts
export default {
  modules: {
    admin: {
      enabled: true,

      // Optional: where the admin UI runtime is sourced from.
      // "builtin" means “use the code in this repo as-is”.
      // "vendored" means “tooling may overlay a vendored runtime into admin-ui”.
      ui: {
        source: "builtin" | "vendored"
      }
    }
  }
}
```

Rules:

* If omitted, `modules.admin.ui.source` defaults to `"builtin"`.
* Setting `source: "vendored"` **does not** change runtime behavior by itself; it only indicates that tooling (e.g. `nomos sync`) is expected to manage upstream overlays.

---

## 5. Database

### 5.1 Single Database Per Environment

**For v1, Nomos supports a single database per environment.**

Each environment (dev, staging, production) connects to one database:

* **Development**: SQLite (default)
* **Staging/Preview**: PostgreSQL or MySQL
* **Production**: PostgreSQL or MySQL

Plugins cannot target different databases. All data resides in a single database instance.

**Note**: Multi-database support may be added in future versions but is explicitly out of scope for v1.

### 5.2 Provider Inference

If `database.provider` is omitted, Nomos infers the provider:

* `url` if `database.url` is present **or** `DATABASE_URL` is set
* `sqlite` otherwise

When defaulting to SQLite, the default file path is:

* `prisma/dev.db`

### 5.3 Explicit Provider

If `database.provider` is set, Nomos must not infer a provider.

Provider selection must be consistent with the configured connection fields.

### 5.4 Configuration Example

```typescript
// SQLite (default for development)
export default {
  database: {
    provider: "sqlite",
    url: "file:./prisma/dev.db"
  }
}

// PostgreSQL (common for staging/production)
export default {
  database: {
    provider: "postgresql",
    url: process.env.DATABASE_URL
  }
}

// MySQL
export default {
  database: {
    provider: "mysql",
    url: process.env.DATABASE_URL
  }
}
```

### 5.5 Connection Pooling and Transactions

**For v1**: No specific configuration for connection pooling or transaction boundaries.

The platform uses Prisma's default connection pooling behavior.

**Future**: May expose connection pool settings and transaction configuration.

---

## 6. Plugin Manager

### 6.1 Default Behavior by Environment

`modules.pluginManager` defaults based on environment:

* **production:** defaults to **off** unless explicitly enabled
* **development/test:** defaults to **on**

### 6.2 Configuration

```typescript
export default {
  modules: {
    pluginManager: true  // Explicit enable
  }
}
```

### 6.3 Governance Expectations

If enabled, plugin manager responsibilities typically include:

* plugin discovery
* plugin enable/disable state
* compatibility checks
* marketplace/install workflows (if present)

Config must allow explicit override to avoid accidental production exposure.

---

## 7. API Settings

### 7.1 Rate Limiting

Configure global rate limiting defaults:

```typescript
export default {
  api: {
    rateLimit: {
      enabled: true,
      default: {
        windowMs: 60 * 1000,    // 1 minute
        maxRequests: 100        // 100 requests per minute
      },
      // Optional: different limits for authenticated vs unauthenticated
      authenticated: {
        windowMs: 60 * 1000,
        maxRequests: 200
      },
      unauthenticated: {
        windowMs: 60 * 1000,
        maxRequests: 50
      }
    }
  }
}
```

### 7.2 CORS

Configure CORS settings:

```typescript
export default {
  api: {
    cors: {
      enabled: true,
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }
  }
}
```

---

## 8. Environment and Overrides

### 8.1 Deterministic Override Strategy

Nomos resolves configuration in the following order (later sources override earlier):

1. **Platform defaults**
2. **Configuration file** (`nomos.config.ts`)
3. **Environment variables**
4. **Runtime flags** (if supported)

### 8.2 Example Override Flow

```typescript
// 1. Platform default
database.provider = "sqlite"

// 2. Config file override
// nomos.config.ts:
export default {
  database: {
    provider: "postgresql",
    url: "postgresql://localhost/dev"
  }
}
// Result: provider = "postgresql"

// 3. Environment variable override
// DATABASE_PROVIDER=mysql
// Result: provider = "mysql"

// 4. Runtime flag override (if implemented)
// --database-provider=sqlite
// Result: provider = "sqlite"
```

### 8.3 Environment Variable Patterns

Nomos maps environment variables into config with the following patterns:

* `DATABASE_URL` → `database.url`
* `DATABASE_PROVIDER` → `database.provider`
* `NODE_ENV` → `runtime.environment`
* `PORT` → `runtime.port`

Env var parsing:

* must be type-safe
* must fail fast on invalid values
* must never log secrets in plaintext

### 8.4 Log level and verbosity

Server logging uses **Pino** and respects `logging.level` and the **`LOG_LEVEL`** environment variable.

Valid levels (least to most verbose): `trace`, `debug`, `info`, `warn`, `error`, `fatal`.

To reduce server log volume without removing any logging code:

* Set **`LOG_LEVEL=warn`** (or `LOG_LEVEL=error`) in your environment, or
* Set **`logging.level: "warn"`** (or `"error"`) in `nomos.config.ts`.

Only messages at or above the configured level are emitted; `info` and `debug` (e.g. per-request logs) are then hidden.

---

## 9. Validation and Diagnostics

### 9.1 Validation

Nomos must validate configuration at startup.

Validation must:

* fail fast on invalid config
* produce actionable diagnostics
* identify the config key path that failed

### 9.2 Unknown Keys

Unknown keys should produce warnings or errors (platform-defined), but must not silently change behavior.

---

## 10. Tooling Notes (Non-runtime)

### 10.1 Vendor Imports and Sync

Some Nomos workflows use **vendor import** overlays to synchronize certain code (commonly the Admin UI runtime) from an upstream repo.

Principles:

* Vendor import is **overlay-only** (no deletes).
* Tooling records **the upstream SHA** and **the imported paths** (e.g. in `.vendor/*.json`).
* Tooling behavior must be **repeatable** and **diff-friendly**.

This tooling is intentionally separate from runtime behavior. The config file may optionally express intent (e.g. `modules.admin.ui.source = "vendored"`), but the presence of that value alone must not mutate runtime behavior.

---

## 11. Complete Configuration Example

```typescript
// nomos.config.ts

export default {
  // Module configuration
  modules: {
    auth: true,
    admin: {
      enabled: true,
      ui: { source: 'builtin' }
    },
    docs: {
      enabled: true,
      openApiPath: "/api/docs"
    },
    pluginManager: false  // Disabled for production
  },

  // Database configuration
  database: {
    provider: "postgresql",
    url: process.env.DATABASE_URL || "postgresql://localhost/nomos_prod"
  },

  // API configuration
  api: {
    // Rate limiting
    rateLimit: {
      enabled: true,
      default: {
        windowMs: 60 * 1000,
        maxRequests: 100
      },
      authenticated: {
        windowMs: 60 * 1000,
        maxRequests: 200
      },
      unauthenticated: {
        windowMs: 60 * 1000,
        maxRequests: 50
      }
    },

    // CORS
    cors: {
      enabled: true,
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://app.example.com'],
      credentials: true
    }
  },

  // Runtime configuration
  runtime: {
    port: parseInt(process.env.PORT || '3001'),
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'production'
  },

  // Observability configuration
  observability: {
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      pretty: process.env.NODE_ENV !== 'production'
    },
    tracing: {
      enabled: true
    },
    metrics: {
      enabled: true
    }
  }
}
```

---

## 12. Environment-Specific Configurations

While Nomos uses a single config file, environment-specific behavior can be achieved through environment variables:

```typescript
// nomos.config.ts

const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

export default {
  database: {
    provider: isDevelopment ? "sqlite" : "postgresql",
    url: isDevelopment
      ? "file:./prisma/dev.db"
      : process.env.DATABASE_URL
  },

  modules: {
    pluginManager: isDevelopment,  // Only in dev
    docs: isDevelopment  // Only in dev
  },

  api: {
    rateLimit: {
      enabled: isProduction,  // Only enforce in production
      default: {
        windowMs: 60 * 1000,
        maxRequests: isDevelopment ? 1000 : 100
      }
    }
  },

  observability: {
    logging: {
      level: isDevelopment ? 'debug' : 'info',
      pretty: isDevelopment
    }
  }
}
```

---

## 13. Required Invariants

A Nomos implementation must preserve the following invariants:

* Config resolution is single-file and priority-based
* Modules are normalized to `{ enabled: boolean }`
* Database provider inference follows the documented rules
* Plugin manager defaults differ between production and non-production
* All config is validated with actionable errors
* Single database per environment (v1 constraint)
