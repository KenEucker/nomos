# Nomos MCP Server Specification

**Status:** Draft

**Version:** 0.1.3

**Audience:** Platform contributors, plugin authors, operators, compliance reviewers

**Scope:** Defines the architecture, boundaries, enablement, and agent-facing responsibilities of the Nomos MCP server

**Applies to:** nomos-core, nomos-ui, all Nomos plugins

---

## Overview

This document is the **specification** for an MCP (Model Context Protocol) server that assists development of a Nomos instance.

It can be **used to generate an implementation prompt**, but it is intentionally written as a durable spec (boundaries, behaviors, responsibilities) rather than as a one-shot codegen prompt.

* The MCP server lives as a **separate app** under the project’s `apps/` folder (e.g. `apps/mcp/`).
* `create-nomos` may optionally include this app (handled in a separate task).
* Docker is **not required**.

Treat this as a *living* spec that will be iterated on.

---

## CONTEXT AND INTENT

Nomos is a Node.js platform (Fastify + Astro) with a strong emphasis on **explicit structure** and **implicit route discovery via file layout**.

This MCP server exists to provide LLM agents with **safe, constrained tooling** to:

* Validate Nomos structure and guarantees (especially **implicit routing**)
* Assist **Admin UI development** for a running Nomos instance
* Scaffold and modify **custom plugins** (primary)
* Modify Nomos core only when necessary

This MCP server **does not need** to be “built like Nomos” (e.g., it does not need SSR concerns). It only needs to provide tools that help agents produce correct changes that follow Nomos specifications.

---

## INITIAL CLARIFICATIONS (ASK FIRST)

Before generating any code, the LLM must ensure these are known. If any are missing, ask follow-up questions.

1. **App Location / Name**

   * Default: `apps/mcp/`
   * Package name suggestion: `@nomos/mcp` or `nomos-mcp`

2. **Primary Transport / Runtime Mode** (choose one, or support both)

   * **HTTP (recommended):** MCP server runs as a Fastify app (machine-to-machine), exposing MCP over HTTP.
   * **stdio (optional):** MCP server runs as a local process for desktop clients; may call Nomos over localhost HTTP.

3. **Targeted Workflows (v1)**

   * Admin UI development assistance
   * Plugin scaffolding and updates
   * Validation and introspection tools (routes/resources/config)

4. **Enablement / Config Flag**

   * MCP must be gated by config flags for **development** and **production**.
   * Clarify how config is represented in Nomos (env vars, config file, central config module).

5. **Agent Scoping Model**

   * Tools should be scoped **per agent**.
   * Clarify what “agent” means in Nomos (agent id, tool profile, per-connection identity, per-project identity).

6. **Filesystem + Repo Boundaries**

   * Confirm whether tools may:

     * read repo files
     * write new files (scaffolding)
     * edit existing plugin files
   * Confirm allowed directories (default: `apps/*`, `plugins/*`, `packages/*`, `docs/*` as appropriate).

7. **Output Preferences**

   * Human-readable strings only, or allow structured JSON embedded in strings.
   * Output size limits and pagination behavior.

---

## YOUR ROLE

You are an expert MCP server developer.

Your task is to create a complete, working MCP server app for Nomos that:

* Provides **validation** and **mutation** tools in a disciplined, explicit way
* Helps agents produce changes that align with **Nomos specs**
* Remains safe and predictable (no magic)

---

## ARCHITECTURAL REQUIREMENTS

### A. Placement and Packaging

* The MCP server is its own app under `apps/mcp/`.
* It may run alongside Nomos apps during development.
* It must be optional: Nomos can run without it.

### B. Transport and Integration

* Prefer an **HTTP** MCP server (machine-to-machine).
* Optionally support **stdio** for desktop clients.
* Avoid SSR concepts in this app unless strictly needed for a UI (not required for v1).

### C. Config Gating

MCP must be disabled by default and enabled via config:

* Example:

  * `NOMOS_MCP_ENABLED=true|false`
  * `NOMOS_MCP_TRANSPORT=http|stdio`
  * `NOMOS_MCP_BIND=127.0.0.1`
  * `NOMOS_MCP_PORT=...`

The exact shape must match Nomos config conventions.

### D. Safety Boundaries (Hard Requirements)

1. **No arbitrary shell execution**
2. **No dynamic eval**
3. **Explicit allowlists** for any command-like behavior
4. **Input validation** for every tool
5. **Output truncation / paging** to avoid runaway responses
6. **No secret leakage** (redact by default)
7. **Filesystem writes are allowed only for explicit scaffolding tools** and only within approved directories

---

## TOOL TAXONOMY (REQUIRED)

Tools must be classified into two categories, and the implementation must enforce the difference.

### 1) Validation Tools (Read-only)

These tools inspect and validate the state of a Nomos instance or repository, without changing anything.

Examples:

* `nomos.validate.routes(filter: str = "")`

  * Validates implicit routing guarantees
  * Can prove a route exists by file structure, and/or by runtime registry

* `nomos.validate.resources()`

  * Lists resources/panels/modules and validates required fields

* `nomos.validate.config(keys: str = "")`

  * Reads config through a safe allowlist; redacts secrets

* `nomos.validate.admin_ui()`

  * Validates that the Admin UI implements required panel/module conventions

### 2) Mutation Tools (Code-writing / Scaffolding)

These tools generate or modify code **in controlled ways** to implement Nomos specs.

Rules:

* Must be explicit about **what files will change**
* Must support **dry-run / plan output**
* Must avoid broad rewrites unless requested

Examples:

* `nomos.scaffold.plugin(name: str = "", description: str = "")`

  * Creates a new plugin skeleton following Nomos plugin specs

* `nomos.scaffold.panel(plugin: str = "", panel: str = "")`

  * Adds a panel module scaffold for Admin UI

* `nomos.apply.patch(target: str = "", patch: str = "")`

  * Applies a constrained patch to a known target area

> Note: This MCP server should primarily support **plugin development**; core modifications are allowed only when necessary.

---

## AGENT SCOPING (REQUIRED)

Tools must be scoped per agent.

The MCP server must support an “agent profile” mechanism, for example:

* Agent identity: `agent_id`
* Allowed tool groups: `validate`, `scaffold`, `patch`
* Allowed write roots: `plugins/*`, optionally `apps/*`
* Max output sizes and rate limits per agent

The spec must define:

* How the agent is identified (header, token, config, connection identity)
* How tool permissions are configured
* How to safely deny tools outside the scope

---

## OUT OF SCOPE: TEKTON (SEPARATE SPEC)

Tekton (the Nomos task/tool runner CLI) is **explicitly out of scope for this document**.

Although many MCP tools may later have 1:1 equivalents as Tekton commands, **that mapping must NOT be defined here**.

Reasons:

* Tekton is a user-facing CLI with its own UX, flags, safety model, and lifecycle
* MCP tools are agent-facing and may have different affordances
* Forcing a shared shape too early would over-constrain both systems

This specification intentionally:

* Defines MCP tools **only in MCP terms**
* Avoids naming Tekton commands, flags, or namespaces
* Leaves reuse of logic as an *implementation detail*, not a spec requirement

A **separate Tekton specification** should be authored later, which may reference this document.

---

## TOOL CATALOG (DEFINED IN TEKTON SPEC)

This MCP specification intentionally does **not** define the full tool catalog.

Instead, the canonical list of tools (names, classifications, inputs/outputs, and scaffolding behaviors) is defined in a **separate Tekton specification**:

* **`docs/tekton.spec.md`** (to be authored)

### Requirements for the shared tool catalog

The Tekton tool catalog must tag each tool with an **execution classification** that the MCP server will enforce:

* `validate` (read-only)
* `mutate` (writes/scaffolding)

The MCP server must expose only the subset of Tekton-defined tools that are marked as:

* MCP-eligible
* safe under current agent scope

### MCP responsibilities regarding the tool catalog

Even though the tool definitions live elsewhere, this MCP server must still enforce:

* tool taxonomy behavior (validate vs mutate)
* per-agent tool allowlists
* dry-run defaults and plan-first outputs for mutations
* filesystem boundaries and redaction

---

## OUTPUT STRUCTURE (FOR THE LLM) (FOR THE LLM)

The LLM must output **two sections only**.

### SECTION 1: FILES TO CREATE

Generate a complete, minimal app under `apps/mcp/`.

Suggested structure:

* `apps/mcp/package.json`
* `apps/mcp/src/server.ts`
* `apps/mcp/src/config.ts`
* `apps/mcp/src/agents.ts` (agent scoping)
* `apps/mcp/src/tools/validate/*.ts`
* `apps/mcp/src/tools/mutate/*.ts`
* `apps/mcp/src/fs.ts` (safe fs helpers; allowlisted roots)
* `apps/mcp/README.md`

If stdio mode is supported, include:

* `apps/mcp/src/stdio.ts`

### SECTION 2: INSTALLATION & RUNNING

Provide:

* How to enable MCP via config flags
* How to run the app in dev (`pnpm -C apps/mcp dev` or equivalent)
* How to point an MCP client at it
* Examples for validation vs mutation tools

---

## CODING RULES (STRICT)

1. No Docker requirement
2. No arbitrary shell execution
3. No dynamic eval
4. All tools must validate inputs and return clear responses
5. Enforce tool taxonomy (validate vs mutate)
6. Enforce per-agent scoping
7. Never leak secrets
8. Keep v1 minimal and focused on Admin UI + plugin dev

---

## ITERATION NOTE

This specification will evolve.

After producing an implementation, pause and ask:

> “What should we tighten: tool scope, agent permissions, write boundaries, or route validation depth?”
