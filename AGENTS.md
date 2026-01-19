# Nomos AI Agents Guide

> This document instructs **AI agents** (LLMs, copilots, and automated code assistants) on how to **develop, extend, and customize the Nomos platform**.
>
> It is intended to be **shipped with Nomos itself** and **copied into new Nomos applications**, where it serves as the canonical source of truth for how Nomos should be evolved—primarily through **plugins**, **resource definitions**, and **panel modules**, not ad‑hoc changes.

---

## Purpose of This File

Nomos is designed to be **AI‑friendly by construction**.

This file exists to:

* Teach AI agents *how Nomos wants to be extended*
* Prevent architectural drift and copy‑paste anti‑patterns
* Encode platform conventions that are difficult to infer from code alone
* Enable users to safely delegate Nomos development to AI systems

If you are an AI reading this file:

> **You are expected to follow this document over your own assumptions.**

---

## Core Principles

### 1. Nomos Is a Platform, Not an App

Nomos is a **host platform** for building applications.

That means:

* Prefer **extensibility** over hard‑coding
* Prefer **configuration + conventions** over custom logic
* Prefer **plugins** over modifying core

If a change *could* be implemented as a plugin, it **should** be.

---

### 2. Optimize for AI‑Driven Development

Nomos explicitly optimizes for LLM workflows:

* Declarative schemas over imperative UI code
* Strong file‑system conventions
* Predictable resolution order
* Minimal hidden magic

If you introduce a pattern that:

* Requires global context
* Requires reading many unrelated files
* Cannot be described succinctly in this document

…it is probably the wrong pattern.

---

### 3. CRUD Is the 80% Case

Nomos assumes:

* **~80%** of admin interfaces are standard CRUD
* **~20%** require customization

The platform is intentionally biased toward making the **80% trivial** and the **20% explicit**.

---

## The Three‑Layer Admin UI Model (Critical)

All admin UI behavior flows through **three distinct layers**.

```
Resource Definitions  →  Panel Modules  →  Templates
(Layer 1)               (Layer 2)         (Layer 3)
```

You **must not collapse these layers**.

### Layer 1 — Resource Definitions (Declarative)

**What they are:**

* Declarative TypeScript objects
* Describe *what* a resource looks like
* No business logic

**What they do:**

* Define fields, columns, endpoints, actions
* Enable automatic CRUD generation

**When to use:**

* Standard CRUD (List / Create / Edit / Show / Delete)
* Simple validation and relationships

**Preferred locations (by convention):**

* Co-located with admin UI routes (common case)
* Defined inline in an `.astro` route when the resource is small
* Provided by plugins when the resource is owned by a plugin

> If CRUD can be expressed here, it *must* be expressed here.

---

### Layer 2 — Panel Modules (Behavior Contracts)

**What they are:**

* The contract between data and UI
* Encapsulate queries, actions, navigation, and lifecycle hooks

**What they do:**

* Load data
* Execute mutations
* Define page‑level behavior

**Important rule:**

> **Astro route files are allowed to compose panel modules directly.**

For simple cases, this is preferred.

**Resolution order:**

1. Route‑aligned handwritten panel module (`src/panels/*.panel.ts`)
2. Auto-derived panel behavior from the resource definition (when no handwritten panel module exists)

**When to write a handwritten panel module:**

* Multi‑endpoint data composition
* Conditional workflows
* Complex validation
* Non‑CRUD admin screens

---

### Layer 3 — Templates (Rendering Only)

**What they are:**

* Svelte components
* Pure rendering logic
* No business rules

**What they do:**

* Render a resolved panel module
* Compose islands and UI primitives

**Override hierarchy (highest → lowest):**

1. Plugin template override
2. Platform module override
3. Resource‑specific template
4. Default template

Templates **must remain dumb**.

---

## Plugins Are the Primary Extension Mechanism

Nomos expects most user‑level customization to happen via **plugins**.

Plugins may:

* Register resources
* Add routes
* Override templates
* Provide admin UI extensions
* Integrate third‑party services

Plugins should **not**:

* Patch core platform code
* Monkey‑patch runtime behavior
* Duplicate existing platform features

If a plugin requires core changes, that is a **platform discussion**, not a plugin decision.

---

## File‑System Conventions Matter

Nomos relies heavily on **predictable structure**.

You must respect:

* Route‑aligned files
* Co‑location of definitions and pages
* Naming conventions

Examples:

```
pages/users/index.astro      → List
pages/users/[id].astro       → Show
pages/users/new.astro        → Create
pages/users/[id]/edit.astro  → Edit
```

Violating these conventions breaks discoverability for both humans **and AI**.

---

## What *Not* to Do (Hard Rules)

❌ Do **not** create wrapper templates that only render a single island

❌ Do **not** split simple routes into multiple `List.ts`, `Detail.ts` files

❌ Do **not** hard‑code admin UI logic into templates

❌ Do **not** bypass the resource system for CRUD

❌ Do **not** invent parallel abstractions

If you feel tempted to do one of these, stop and reassess.

---

## Backend Expectations

Admin-facing routes/resources consumed by the admin UI expect:

* Consistent REST semantics
* Zod validation
* Predictable response shapes

Standard success shape:

```ts
{
  ok: true,
  data: {...},
  meta?: {...}
}
```

Standard error shape:

```ts
{
  ok: false,
  error: { code: string, message: string }
}
```

Breaking this contract breaks the admin UI.

---

## Non‑CRUD Admin Screens

Some admin screens are **intentionally not CRUD**:

* Jobs
* Webhooks
* Audit logs
* Error logs
* Diagnostics

These should be implemented as:

* Handwritten panel modules
* Custom templates
* View‑only or action‑limited interfaces

Do **not** force these into the CRUD system.

---

## How AI Agents Should Approach Changes

When asked to modify or extend Nomos:

1. **Identify the layer** involved
2. Prefer the **lowest layer possible**
3. Prefer **configuration over code**
4. Prefer **plugins over core changes**
5. Maintain architectural symmetry

If you are unsure:

> Stop and ask for clarification rather than guessing.

---

## Guiding Question

Before implementing anything, ask:

> *Will this make Nomos easier or harder for the **next AI** to understand?*

If the answer is “harder”, rethink the approach.

---

## Final Note

Nomos is intentionally opinionated.

Those opinions exist to:

* Enable delegation to AI
* Keep systems understandable at scale
* Avoid framework entropy

If you follow this document closely, your changes will almost always align with the platform’s intent.

**This file is normative. Treat it as part of the platform API.**
