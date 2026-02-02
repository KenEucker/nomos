# Nomos Tooling Specification

**Status:** Draft

**Version:** 0.1.3

**Audience:** Platform contributors, plugin authors, operators

**Scope:** Defines **Tekton** as the canonical Nomos tooling surface (scaffolding, validation, codegen, and ops-friendly helpers)

**Applies to:** `nomos` CLI entrypoints, `npm create nomos@latest`, `nomos create`, Nomos workspaces (core, ui, plugins, apps)

---

## Overview

Tekton is the **tooling surface** for Nomos.

It provides a consistent, scriptable command interface for:

* creating new Nomos platform instances
* scaffolding plugins and Admin UI building blocks
* validating implicit routing/resource conventions
* applying constrained patches and code generation
* operational inspection helpers (where appropriate)

Tekton is also the **canonical source of truth** for the tool catalog that the Nomos MCP server may expose (subject to MCP-specific safety and agent scoping).

---

## Relationship to `npm create nomos@latest`

Nomos provides a project generator that can be invoked via:

* `npm create nomos@latest`

This runs the Nomos creation script (the generator) and produces a new Nomos platform instance.

Within a generated Nomos instance, Tekton is the primary CLI runner.

### `nomos create` shorthand

Inside a Nomos instance:

* `nomos create` is shorthand for calling Tekton’s project creation workflow.

This allows a consistent experience across:

* initial generation (`npm create nomos@latest`)
* subsequent creation workflows (new instances, apps, plugins) from within an existing instance

---

## Design goals

* **One canonical tool catalog:** The same set of tools can be used by humans (CLI) and agents (MCP), but with different access control.
* **Explicit behavior:** Tools should be deterministic and discoverable; avoid magic.
* **Plan-first mutations:** Scaffolding and code-writing tools must support dry-run planning.
* **Workspace-aware:** Tools understand the Nomos monorepo layout (`apps/`, `plugins/`, `packages/`, `docs/`).
* **Composable:** Tools can be invoked individually or chained.

---

## Non-goals

* Tekton is not a general-purpose task runner like Make.
* Tekton does not replace package scripts; it provides stable, domain-specific commands.
* Tekton should not depend on Docker as a requirement.

---

## Terminology

* **Tool:** A single Tekton command capability (validate, scaffold, codegen, patch, inspect).
* **Tool catalog:** The canonical list of tools, their classification, inputs, outputs, and safety semantics.
* **Workspace root:** The root directory of a Nomos instance repository.
* **Write roots:** Allowed directories for mutations (typically `plugins/*`, optionally `apps/*`, `packages/*` depending on tool).

---

## CLI entrypoints

### Primary entrypoint

Tekton is invoked via the Nomos CLI runner.

Recommended conceptual form:

* `nomos tekton <tool> [args] [--flags]`

### NPM script compatibility

Tekton should be invokable through package scripts to support consistent tooling in CI/dev:

* `npm run nomos tekton <tool> [args]`

> Exact script wiring is implementation detail; this spec defines expected behavior, not the package.json layout.

---

## Tool taxonomy (required)

Every tool must declare a **classification**:

1. **`validate`**

   * Performs **code-level validation** to ensure correctness.
   * May run:

     * static checks (lint/typecheck)
     * spec/convention validation (routing/resources/manifests)
     * test suites (unit/integration/e2e) when explicitly requested
   * **Must not** mutate files.

2. **`mutate`**

   * Performs **coding/scaffolding tasks** that create or modify platform code.
   * Writes files, applies patches, or generates code.
   * Must support plan-first output and dry-run defaults.

3. **`operate`**

   * Performs **runtime-level tasks** against a running Nomos instance.
   * Provides diagnostics, debugging, inspection, and operational helpers.
   * Must not modify repo source code by default.
   * May require an explicit target (host/port/environment) and credentials.

This classification is authoritative and is used by:

* Tekton UX (warnings, confirmations)
* CI policies (allowed tool classes)
* the Nomos MCP server (what can be exposed to agents)

---

## Mutation semantics (required)

All `mutate` tools must:

* default to **dry-run** unless explicitly applied
* produce a **plan** describing:

  * files that would be created/modified
  * a concise summary of changes
* support a consistent “apply” mechanism

### Standard mutation flags (conceptual)

This spec standardizes semantics, not exact flag names. However, the CLI should provide equivalents for:

* `--dry-run` (default true)
* `--apply` (or `--dry-run=false`)
* `--write-root` (optional override within allowlisted boundaries)

---

## Output formats

Tekton output should be human-readable by default, with an option for structured output suitable for CI.

### Recommended modes

* **Human mode (default):** readable text, concise summaries
* **JSON mode (optional):** machine-readable output for CI and automation

If JSON mode exists, every tool must provide a stable schema version.

---

## Tool catalog (canonical)

This section defines the tools Tekton provides.

### Tool definition template (required)

Each tool entry must include:

* **Name** (stable identifier)
* **Classification**: `validate` | `mutate` | `operate`
* **Purpose**
* **Inputs** (arguments + flags)
* **Outputs**
* **Write boundaries** (for mutate tools)
* **Dry-run behavior** (for mutate tools)
* **Failure modes** (common errors)

> NOTE: The detailed tool list will be expanded incrementally. Start with tools needed for Admin UI + plugin development.

---

## Initial tool groups (v1 focus)

### Validate (code-level)

* Routing validation and route proof (implicit routing guarantees)
* Resource/panel/module validation (nomos-ui spec alignment)
* Plugin manifest validation (nomos-plugin spec alignment)
* Workspace boundary checks (allowed read/write roots)
* Optional: run lint/typecheck/tests via underlying package scripts

### Mutate (scaffolding/codegen)

* Plugin scaffolding
* Admin UI panel scaffolding
* Resource scaffolding
* Admin page/view scaffolding
* Constrained patch application

### Operate (runtime-level)

* Health/version/status checks for a running Nomos instance
* Route/resource registry inspection on a running instance
* Observability diagnostics (recent errors, traces, slow endpoints)
* Debug helpers (dump config keys allowlisted, feature flags, enabled plugins)

---

## Tool catalog (concrete)

This section defines the **concrete** Tekton tools. Tools are grouped by taxonomy.

### Conventions

* Tool names are stable identifiers and are shown as `tekton <name>`.
* Flags shown here are **normative** for behavior, but exact CLI parsing is an implementation detail.
* `mutate` tools must support:

  * `--dry-run` (default: true)
  * `--apply` (explicitly apply changes)
  * `--write-root <path>` (optional, constrained)
* Tools should support `--json` output where appropriate.

### Validate tools

#### 1) `validate:workspace`

* **Classification:** `validate`
* **Purpose:** Verify the current directory is a Nomos workspace root and summarize layout.
* **Inputs:**

  * `--cwd <path>` (optional)
  * `--json`
* **Outputs:**

  * Human: detected workspace root, package manager, and discovered folders (`apps/`, `plugins/`, `packages/`, `docs/`).
  * JSON (optional): `{ root, packageManager, paths, warnings[] }`
* **Failure modes:** not a workspace; missing required folders; unreadable files.

#### 2) `validate:routes`

* **Classification:** `validate`
* **Purpose:** Validate implicit routing guarantees from file structure and/or generated route registry.
* **Inputs:**

  * `--filter <pattern>` (optional)
  * `--mode file|registry|both` (default: `both`)
  * `--json`
* **Outputs:**

  * Human: list of routes with proof source(s) and any violations.
  * JSON: `{ routes: [{ path, methods?, proofs[] }], violations[] }`
* **Failure modes:** route inference error; registry missing; violations found.

#### 3) `validate:route-proof`

* **Classification:** `validate`
* **Purpose:** Produce a “proof” explaining why a given route exists.
* **Inputs:**

  * `<route>` (required)
  * `--mode file|registry|both` (default: `both`)
  * `--json`
* **Outputs:**

  * Human: normalized route + proof chain (files/modules/resources) + derived methods.
  * JSON: `{ route, normalized, proofs: [{ kind, ref, detail }] }`
* **Failure modes:** route not found; ambiguous route; proof generation error.

#### 4) `validate:resources`

* **Classification:** `validate`
* **Purpose:** Validate resources/panels/modules against `nomos-ui` specifications.
* **Inputs:**

  * `--filter <pattern>` (optional)
  * `--json`
* **Outputs:**

  * Human: resources list with pass/fail and per-resource issues.
  * JSON: `{ resources: [{ id, status, issues[] }], violations[] }`
* **Failure modes:** resource load error; invalid definitions; missing required fields.

#### 5) `validate:plugin`

* **Classification:** `validate`
* **Purpose:** Validate a plugin manifest and required structure against `nomos-plugin` specs.
* **Inputs:**

  * `<plugin>` (name or path, required)
  * `--json`
* **Outputs:**

  * Human: pass/fail + field-level errors + missing files.
  * JSON: `{ plugin, status, issues[] }`
* **Failure modes:** plugin not found; manifest parse error; spec violations.

#### 6) `validate:tests`

* **Classification:** `validate`
* **Purpose:** Run code-level test suites (lint/typecheck/unit/integration) for a selected scope.
* **Inputs:**

  * `--scope core|ui|plugins|all` (default: `all`)
  * `--kind lint|typecheck|unit|integration|e2e|all` (default: `all`)
  * `--json`
* **Outputs:**

  * Human: summary + failing commands and locations.
  * JSON: `{ scope, kind, results: [{ name, status, durationMs, outputPath? }] }`
* **Failure modes:** underlying scripts missing; test failures; timeout.

### Mutate tools

#### 1) `create`

* **Classification:** `mutate`
* **Purpose:** Create a new Nomos platform instance from templates.
* **Notes:** This is the workflow invoked by `nomos create` shorthand.
* **Inputs:**

  * `<directory>` (optional; default: current directory name)
  * `--name <projectName>`
  * `--with-mcp true|false` (default: false)
  * `--dry-run` / `--apply`
  * `--json`
* **Outputs:**

  * Plan: files and folders to be created.
  * Apply: created instance summary + next steps.
* **Write boundaries:** new directory only.
* **Failure modes:** directory exists; template missing; permission denied.

#### 2) `plugin:new`

* **Classification:** `mutate`
* **Purpose:** Scaffold a new Nomos plugin.
* **Inputs:**

  * `<name>` (required)
  * `--description <text>` (optional)
  * `--dry-run` / `--apply`
  * `--write-root plugins` (default)
  * `--json`
* **Outputs:**

  * Plan: created files (manifest, entrypoints, docs stubs).
  * Apply: plugin created + registration hints.
* **Write boundaries:** `plugins/*`
* **Failure modes:** plugin exists; invalid name; write boundary denied.

#### 3) `admin:panel:new`

* **Classification:** `mutate`
* **Purpose:** Scaffold a panel module inside a plugin for Admin UI.
* **Inputs:**

  * `--plugin <name|path>` (required)
  * `--panel <PanelName>` (required)
  * `--dry-run` / `--apply`
  * `--json`
* **Outputs:**

  * Plan: new panel module files + registration diff.
  * Apply: panel created + where to link it.
* **Write boundaries:** plugin directory.
* **Failure modes:** plugin not found; panel exists; invalid panel name.

#### 4) `admin:resource:new`

* **Classification:** `mutate`
* **Purpose:** Scaffold a new resource definition aligned to nomos-ui specs.
* **Inputs:**

  * `--plugin <name|path>` (required)
  * `--resource <ResourceName>` (required)
  * `--dry-run` / `--apply`
  * `--json`
* **Outputs:** plan + registration guidance.
* **Write boundaries:** plugin directory.
* **Failure modes:** resource exists; plugin invalid; spec mismatch.

#### 5) `admin:page:new`

* **Classification:** `mutate`
* **Purpose:** Scaffold an admin page/view wired into panel modules.
* **Inputs:**

  * `--plugin <name|path>` (required)
  * `--page <PageName>` (required)
  * `--route <path>` (optional)
  * `--dry-run` / `--apply`
  * `--json`
* **Outputs:** plan + route/resource wiring notes.
* **Write boundaries:** plugin directory.
* **Failure modes:** page exists; invalid route; wiring conflict.

#### 6) `patch:apply`

* **Classification:** `mutate`
* **Purpose:** Apply a constrained patch to an allowlisted target.
* **Inputs:**

  * `--target <file|anchor>` (required)
  * `--patch <path|inline>` (required)
  * `--dry-run` / `--apply`
  * `--json`
* **Outputs:** plan of hunks + apply summary.
* **Write boundaries:** allowlisted paths only.
* **Failure modes:** target denied; patch parse error; hunk failed.

### Operate tools

#### 1) `operate:health`

* **Classification:** `operate`
* **Purpose:** Check a running Nomos instance health/version and enabled features.
* **Inputs:**

  * `--url <baseUrl>` (default: `http://localhost:3000`)
  * `--auth <token|profile>` (optional)
  * `--json`
* **Outputs:**

  * Human: status + version/build + enabled modules summary.
  * JSON: `{ status, version, build, features }`
* **Failure modes:** connection error; auth failed; endpoint missing.

#### 2) `operate:routes`

* **Classification:** `operate`
* **Purpose:** Inspect runtime route registry of a running Nomos instance.
* **Inputs:**

  * `--url <baseUrl>`
  * `--filter <pattern>`
  * `--json`
* **Outputs:** routes + methods as reported by runtime.
* **Failure modes:** endpoint unavailable; insufficient permissions.

#### 3) `operate:resources`

* **Classification:** `operate`
* **Purpose:** Inspect runtime resources/panels/modules registry.
* **Inputs:**

  * `--url <baseUrl>`
  * `--filter <pattern>`
  * `--json`
* **Outputs:** resource list + metadata.
* **Failure modes:** endpoint unavailable; insufficient permissions.

#### 4) `operate:observability`

* **Classification:** `operate`
* **Purpose:** Pull recent runtime diagnostics (errors, slow requests, traces) from the running instance.
* **Inputs:**

  * `--url <baseUrl>`
  * `--since <duration>` (e.g. `15m`, `1h`)
  * `--limit <n>` (default: `50`)
  * `--json`
* **Outputs:** summarized diagnostics + pointers/ids.
* **Failure modes:** observability backend unavailable; permissions.

---

## MCP integration contract (informative) (informative)

The Nomos MCP server may expose Tekton tools to LLM agents.

However, MCP must enforce additional constraints not required for CLI users, including:

* per-agent tool allowlists
* stricter write-root boundaries
* mandatory plan-first behavior
* redaction of secrets and sensitive data

Tekton is the **canonical tool catalog**; MCP is a **controlled projection** of that catalog.

---

## Versioning

* Tool names should be stable once published.
* Breaking changes to tool inputs/outputs require a spec version bump.
* If JSON output exists, it must include a schema version.

---

## Iteration note

This specification will evolve as Tekton is implemented.

Next steps:

1. Add the **concrete tool list** (names + definitions) needed for Admin UI + plugin workflows.
2. Define the minimal JSON output schema (if needed).
3. Define workspace discovery rules (how Tekton locates Nomos root).
