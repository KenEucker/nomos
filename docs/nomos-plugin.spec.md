# Nomos Plugin Specification

**Status:** Active Draft

**Version:** 0.1.0

**Audience:** Framework users, plugin authors, platform contributors

**Scope:** Defines the plugin contract, capabilities, boundaries, and integration rules

---

## 1. Overview

Nomos plugins are the primary mechanism for extending a Nomos application.

A plugin is a **capability bundle** that can contribute one or more of:

* API routes
* Services
* UI modules (PanelModules)
* Resource Definitions
* Authorization artifacts (policies, intents)
* Lifecycle hooks
* Event listeners and emitters
* Database models / migrations (via platform mechanisms)

Plugins are intended to be usable by:

* developers building new features without reinventing platform concerns
* teams sharing reusable features across multiple Nomos apps
* non-developers installing well-defined feature packages (e.g., from a marketplace)

---

## 2. Plugin Design Goals

### 2.1 Declarative Composition

Plugins describe **what they provide**, not how the system is wired.

The platform kernel is responsible for:

* discovery
* ordering
* validation
* registration
* lifecycle orchestration

---

### 2.2 Isolation with Controlled Integration

Plugins must be:

* self-contained
* predictable
* safe to install and remove

Plugins integrate only through platform-defined mechanisms:

* service registry
* route registry
* UI registry
* policy/authorization registry
* event bus
* hooks

Direct coupling is allowed only through stable contracts.

---

### 2.3 Plugin Purity

**Plugins should only access what the platform provides.**

Plugins SHOULD NOT:
* Import modules outside their plugin scope
* Access global state directly
* Monkey-patch platform internals
* Bypass platform registries

This isolation:
* Prevents hidden dependencies
* Enables safer preview/sandbox workflows
* Improves testability
* Simplifies reasoning about system behavior

---

### 2.4 Marketplace Compatibility

A plugin must be describable and auditable.

A plugin is expected to declare:

* identity
* version
* compatibility constraints
* the surfaces it contributes
* the intents/policies it introduces

---

## 3. Plugin Contract

### 3.1 Identity

Each plugin has a stable identity:

* `name` (unique)
* `version`

Plugins may also expose metadata:

* `displayName`
* `description`
* `author`
* `homepage`

---

### 3.2 Compatibility

Plugins must declare compatibility with the Nomos platform version.

Compatibility is evaluated by the platform during boot.

If incompatible, the plugin must:

* not load
* produce a clear diagnostic error

---

## 4. Plugin Capabilities

A plugin may contribute any subset of the following capabilities.

### 4.1 API Routes

Plugins may contribute API routes through platform routing conventions.

Routes must:

* participate in platform observability
* participate in platform authorization
* expose schemas for validation and type inference

---

### 4.2 Services

Plugins may register services into the service registry.

Services must:

* be named
* be stable across minor versions where possible
* accept platform-provided dependencies through injection (not globals)

Services may be consumed by:

* routes
* other services
* UI actions
* jobs
* hooks

---

### 4.3 UI Contributions

Plugins may contribute:

* PanelModules
* Resource Definitions
* navigation entries
* UI actions

UI contributions must:

* conform to Nomos-UI contracts
* respect policy evaluation outcomes
* avoid bypassing platform access checks

---

### 4.4 Authorization Contributions

Plugins may introduce authorization artifacts, such as:

* intents (permissions)
* policies
* resource-level access rules

Authorization artifacts must:

* produce auditable decisions
* include evidence and rationale
* integrate with the platform authorization engine

---

### 4.5 Database Contributions

Plugins may require database schema.

All schema changes must be expressed via platform migration mechanisms.

Plugins must not:

* mutate schema ad hoc at runtime
* bypass the migration system

---

### 4.6 Lifecycle Hooks

Plugins may provide lifecycle hooks, such as:

* `setup` (one-time initialization)
* `start` (runtime enable)
* `stop` (runtime disable)

Hook execution order is controlled by the platform and is deterministic.

Hooks must:

* be idempotent where applicable
* fail loudly and diagnostically
* avoid hidden side effects

**Hook Ordering**: Hooks execute in plugin load order, which is deterministic based on filesystem discovery.

---

### 4.7 Events and Hooks

Plugins may:

* emit events
* subscribe to events
* register hooks that run before/after defined operations

Events are preferred for loose coupling.

Hooks must:

* be explicit
* be scoped
* be observable

---

### 4.8 Jobs / Scheduling

Plugins may register scheduled jobs.

Jobs must:

* be observable
* be traceable to plugin identity
* respect platform access/policy rules when mutating data

---

## 5. Plugin Lifecycle

### 5.1 Boot Sequence

The platform boots plugins in the following sequence:

```
1. Discovery
   - Scan plugin directories
   - Collect plugin manifests
   
2. Validation
   - Check compatibility
   - Validate structure
   - Detect conflicts
   
3. Setup (one-time)
   - Run plugin setup() hooks
   - Apply database migrations
   - Ensure intents in database
   
4. Start (every boot)
   - Run plugin start() hooks
   - Register services
   - Register routes
   - Mount UI contributions
```

### 5.2 Hook Execution Order

Hooks execute in deterministic plugin load order:

* Plugins are discovered in filesystem order
* Within a lifecycle phase (setup, start), hooks execute sequentially
* If a hook fails, subsequent hooks in that phase do not run

**Example**:
```
plugins/
  analytics/    # Loads first
  reporting/    # Loads second
  custom/       # Loads third

Setup execution:
1. analytics.setup()
2. reporting.setup()
3. custom.setup()
```

### 5.3 Failure Handling

If a plugin fails during any lifecycle phase:

* The plugin does not complete that phase
* Other plugins continue loading
* The failure is logged with diagnostic information
* The system may choose to disable the failed plugin

The platform does not enter a partially-initialized state. Either a plugin completes initialization or it is marked as failed.

---

## 6. Plugin Upgrades

### 6.1 Upgrade Workflow

When a plugin is upgraded:

```
1. New version uploaded/detected
2. Plugin enters PREVIEW state
3. Approval process:
   - Manual approval (admin UI)
   - OR automatic approval (based on settings)
4. Once approved:
   - Platform runs upgrade hooks
   - Database migrations applied
   - Plugin reloaded (hot-reload if possible)
```

### 6.2 Data Migration

Plugins define data migrations using platform conventions:

```typescript
// In plugin manifest:
export const plugin = definePlugin({
  name: "my-plugin",
  version: "2.0.0",
  
  migrations: [
    {
      from: "1.0.0",
      to: "2.0.0",
      up: async (ctx) => {
        // Migrate data from v1 to v2
        await ctx.db.task.updateMany({
          where: { pluginId: "my-plugin" },
          data: { status: mapOldStatus() }
        })
      },
      down: async (ctx) => {
        // Rollback if needed
      }
    }
  ]
})
```

### 6.3 Hot-Reload Support

Plugins SHOULD support hot-reload for non-breaking changes.

Hot-reload is supported when:
* No database schema changes
* No breaking API changes
* Version bump is minor or patch

Hot-reload is NOT supported when:
* Breaking schema changes (requires restart)
* Major version bump
* Platform compatibility change

### 6.4 Version Compatibility

Plugins use semantic versioning:

* **Major** (x.0.0): Breaking changes, requires migration, may require restart
* **Minor** (0.x.0): New features, backward compatible, supports hot-reload
* **Patch** (0.0.x): Bug fixes, backward compatible, supports hot-reload

---

## 7. Plugin Dependencies

### 7.1 Recommendation: Avoid Inter-Plugin Dependencies

For better developer experience and simpler architecture, plugins SHOULD avoid depending on other plugins.

Instead:
* Extract shared functionality into platform services
* Use event-based communication
* Contribute to shared resource definitions

### 7.2 When Dependencies Are Necessary

If dependencies cannot be avoided:

```typescript
export const plugin = definePlugin({
  name: "reporting",
  version: "1.0.0",
  
  // Optional: declare service requirements
  requires: {
    services: ["analytics.metrics"]  // Require specific services
  }
})
```

The platform:
* Validates required services exist
* Fails plugin load if requirements not met
* Logs clear diagnostic errors

**No automatic dependency ordering** is provided. Plugin authors are responsible for ensuring required services are available.

---

## 8. Platform Integration Rules

### 8.1 No Hidden Wiring

Plugins must not:

* monkey-patch platform internals
* mutate global state
* register routes/services outside registries

All integration occurs via documented registries.

---

### 8.2 Deterministic Loading

Plugin loading must be deterministic.

The platform must be able to:

* list all discovered plugins
* validate each plugin
* report load order and rationale

---

### 8.3 Capability Registration is Explicit

The platform must be able to answer:

* which plugin provided a route
* which plugin provided a service
* which plugin provided a PanelModule
* which plugin provided a policy

This is required for:

* debugging
* compliance
* marketplace auditing

---

## 9. Plugin Sandbox and Security

### 9.1 Preview Phase

Before being enabled, plugins SHOULD go through a preview/sandbox phase where:

* Schema changes can be inspected
* Intent declarations can be reviewed
* Contributed surfaces can be tested

**Note for v1**: Full sandboxing is not implemented. Plugins run with full Node.js access once enabled. This is a known risk.

### 9.2 Production Enablement

Once enabled in production, plugins run with:

* Full Node.js process access
* Access to all platform APIs
* Ability to execute arbitrary code

**Security Note**: Future versions may implement true sandboxing via:
* Worker threads
* V8 isolates
* Process isolation

For v1, plugin security relies on:
* Code review during preview
* Marketplace vetting
* Admin approval workflows

---

## 10. Error and Failure Model

If a plugin fails to load or initialize, the system must:

* identify the plugin and capability that failed
* provide actionable diagnostics
* avoid partial/undefined registration

Plugins must not leave the platform in an inconsistent state.

---

## 11. Versioning and Compatibility

Plugins are versioned independently, but must:

* declare platform compatibility
* provide migration paths when changing schemas or contracts

Breaking changes must:

* require a major version bump
* include upgrade notes
* possibly require admin approval

---

## 12. Non-Goals

Plugins are not:

* arbitrary code injection
* a scripting layer
* an uncontrolled extension point

Plugins are controlled capability bundles operating under platform governance.

---

## 13. Summary

Nomos plugins are declarative capability providers.

They extend the platform through explicit registries and contracts, integrate cleanly with Nomos-UI and authorization, remain observable and auditable at every step, and maintain isolation while enabling controlled composition.

Key principles:
* **Purity**: Access only what platform provides
* **Determinism**: Predictable load order and hook execution
* **Isolation**: Minimal inter-plugin coupling
* **Observability**: Every action is traceable
* **Safety**: Preview before enable, migrations for data changes