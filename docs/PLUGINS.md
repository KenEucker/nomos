# Plugins in Nomos

This document describes the built-in **pluginManager** module and the filesystem plugin contract.

## Filesystem plugin layout

Plugins live under the configured plugins directory (default: `src/plugins/<slug>/`).

Discovery requires **one** of the following entry files:

- `src/plugins/<slug>/plugin.ts|js|mjs`
- `src/plugins/<slug>/index.ts|js|mjs`

The entry file must export a plugin manifest (default export preferred):

```ts
export type PluginPermission =
  | "routes:read"
  | "routes:write"
  | "admin:extend"
  | "db:migrate"
  | "config:read"
  | "config:write"
  | string;

export type PluginManifest = {
  slug?: string; // defaults to folder name
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  permissions?: PluginPermission[];
  nomos?: {
    minVersion?: string;
    maxVersion?: string;
  };
  preview?: (ctx: PreviewContext) => Promise<PluginPlan> | PluginPlan;
};
```

## Lifecycle

The pluginManager module models a WordPress-style lifecycle:

```
discovered → installed → staged → enabled / disabled
```

- **discovered**: found on disk but not installed.
- **installed**: registered in the database (activation is still off).
- **staged**: preview succeeded.
- **enabled**: activated for runtime (future hook points).
- **disabled**: installed but not active.
- **broken**: discovery or preview failed; activation is blocked.

## Preview plan format

Preview returns a deterministic, pure-data plan (`PluginPlan`):

```ts
export type PluginPlan = {
  slug: string;
  version: string;
  summary?: string;
  warnings?: string[];
  permissionsRequested?: PluginPermission[];
  routes?: {
    add?: Array<{ method: string; path: string; description?: string }>;
    remove?: Array<{ method: string; path: string }>;
  };
  admin?: {
    pagesAdd?: Array<{ path: string; title: string; description?: string }>;
    menuAdd?: Array<{ label: string; path: string; icon?: string }>;
  };
  configKeys?: Array<{ key: string; required?: boolean; description?: string }>;
};
```

Preview is required by default before enabling a plugin (configurable).

## Security model and sandboxing

Preview execution defaults to **restricted** mode:

- Network access: **denied**
- Filesystem access: **denied**
- Preview context is sealed and only exposes safe config/environment data.

Restricted mode is a **best-effort policy**. It avoids exposing helpers for I/O but still runs in-process. Use `sandbox.mode` to loosen or tighten behavior:

- `restricted` (default): best-effort policy, no fs/net helpers.
- `none`: no restrictions (not recommended).
- `isolated`: placeholder for stronger isolation (not yet implemented).

## Configuration

All built-in modules are config-controlled. The pluginManager module is **off by default in production**.

Example config:

```ts
export default {
  modules: {
    pluginManager: {
      enabled: true,
      api: {
        enabled: true,
        allowUnauthenticated: false
      },
      ui: {
        enabled: true
      },
      discovery: {
        pluginDir: "src/plugins",
        includePatterns: ["*/plugin.{ts,js,mjs}", "*/index.{ts,js,mjs}"]
      },
      activation: {
        useDatabase: true
      },
      preview: {
        enabled: true,
        require: true,
        strategy: "plan"
      },
      sandbox: {
        mode: "restricted",
        network: "deny",
        filesystem: "deny"
      }
    }
  }
};
```

## API surface (when enabled)

```
GET    /plugins
GET    /plugins/:slug
POST   /plugins/:slug/install
POST   /plugins/:slug/preview
POST   /plugins/:slug/enable
POST   /plugins/:slug/disable
POST   /plugins/:slug/uninstall
```

These endpoints require admin access when auth is enabled.

## Admin UI

When the admin UI module is enabled, a **Plugins** screen is available at `/admin/plugins` to install, preview, enable, and disable plugins.
