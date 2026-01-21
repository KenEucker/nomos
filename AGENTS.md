# Nomos — Agent Guide (Root)

> This file defines **how Nomos is meant to be understood, extended, and evolved**.
>
> It is written primarily for **AI agents**, but it is equally normative for human contributors.
>
> If guidance in this file conflicts with assumptions derived from code inspection,
> **this file and the specification documents take precedence**.

---

## What Nomos Is

Nomos is a **platform**, not an application.

It is designed to host:

* APIs
* Admin and operational UIs
* Authorization and policy logic
* Observability and audit infrastructure
* Plugins that extend all of the above

Nomos is **contract-first**, **policy-driven**, and **observable by default**.

There is no sharp boundary between “backend” and “admin UI” in Nomos.
They are **two surfaces of the same runtime**.

---

## Source of Truth

Nomos is governed by **specification documents**, not ad-hoc conventions.

Before modifying or generating code, agents MUST align with:

* Platform architecture and scope
* Authorization (AuthZ) model
* API routing and contracts
* Configuration and runtime behavior
* Observability and decision artifacts
* Plugin boundaries and lifecycle
* Nomos-UI abstractions (Panels, PanelModules, ResourceDefinitions)

If something is unclear:

> **Consult the relevant specification before inventing behavior.**

---

## Core Design Principles (Non‑Negotiable)

### 1. Declarative Over Imperative

Nomos prefers:

* schemas over runtime inference
* contracts over conventions
* explicit declarations over hidden magic

If behavior cannot be explained declaratively, it should be questioned.

---

### 2. Determinism Over Convenience

Nomos favors:

* filesystem‑discoverable structure
* predictable resolution order
* static analyzability

An agent should be able to understand the system **without executing it**.

---

### 3. Intent‑Based Authorization Everywhere

All access control is expressed as **intents** (`resource.action`).

This applies equally to:

* UI gating
* API routing
* background jobs
* admin panels

All surfaces must rely on the **same authorization engine**.

There are:

* no direct role checks
* no implicit permissions
* no UI‑only authorization logic

---

### 4. Observability Is a Platform Concern

Logging, tracing, metrics, and decisions are **not optional**.

Important actions must:

* emit structured events
* record outcomes
* be explainable (DECIDE)
* be correlatable across layers

Agents must never introduce silent or opaque behavior.

---

### 5. Plugins Are the Primary Extension Mechanism

If a change can be implemented as a plugin, **it should be**.

Core code should evolve slowly.
Plugins are where customization lives.

---

## Architectural Layers (Mental Model)

Nomos should be understood as layered but unified:

```
┌──────────────────────────────┐
│ Nomos Runtime                │
│                              │
│  ┌──────── API ───────────┐  │
│  │ Zod • Routes • Intents │  │
│  └───────────────────────┘  │
│                              │
│  ┌────── Admin UI ────────┐  │
│  │ Panels • Resources     │  │
│  │ SSR + CSR              │  │
│  └───────────────────────┘  │
│                              │
│  ┌──── Authorization ─────┐ │
│  │ Subjects • Intents     │ │
│  │ Policies • Decisions   │ │
│  └───────────────────────┘ │
│                              │
│  ┌──── Observability ─────┐ │
│  │ Events • DECIDE        │ │
│  │ Metrics • Traces       │ │
│  └───────────────────────┘ │
│                              │
│  ┌──────── Plugins ───────┐ │
│  │ Routes • UI • Policies │ │
│  │ Services • Hooks       │ │
│  └───────────────────────┘ │
└──────────────────────────────┘
```

No layer bypasses another.
All layers participate in authorization and observability.

---

## UI Model (Critical)

Nomos‑UI follows a **strict three‑layer model**:

```
ResourceDefinitions → PanelModules → Templates
```

* **ResourceDefinitions**
  Serializable, declarative, no functions
  Enable auto‑generated CRUD

* **PanelModules**
  TypeScript modules, may contain logic
  Define data loading, actions, and intent requirements

* **Templates**
  Rendering only
  No business logic, no access decisions

Agents MUST NOT collapse these layers.

---

## Backend Expectations

API behavior consumed by Nomos‑UI assumes:

* REST‑style semantics
* Zod validation
* stable response shapes
* intent enforcement at the routing layer

Authorization failures must be:

* explicit
* structured
* observable

---

## Authorization Expectations

Authorization is:

* **subject‑based**, not user‑based
* **deny‑by‑default**
* **explainable**

Every decision can produce:

* evidence
* rationale
* DECIDE artifacts

Agents must never:

* assume a user model
* hard‑code role logic
* skip authorization for “internal” paths

---

## Observability Expectations

When adding or modifying behavior, ask:

* What event does this emit?
* What decision is being made?
* What evidence exists?
* Can this be explained after the fact?

If the answer is “nothing”:

> The change is incomplete.

---

## How Agents Should Approach Changes

When asked to implement something:

1. Identify the **layer** (API, UI, AuthZ, Plugin, Observability)
2. Prefer the **lowest declarative layer**
3. Prefer **existing platform mechanisms**
4. Prefer **plugins over core changes**
5. Preserve determinism and analyzability

If unsure:

> Stop and ask rather than guessing.

---

## What Not to Do (Hard Rules)

❌ Do not introduce hidden runtime discovery
❌ Do not bypass intent checks
❌ Do not log instead of emitting events
❌ Do not embed policy logic in UI templates
❌ Do not invent parallel abstractions
❌ Do not optimize prematurely at the cost of clarity

---

## Guiding Question (Always Ask This)

> **Will this make Nomos easier or harder for the next agent to understand and extend?**

If harder, rethink the approach.

---

## Final Note

This file is **normative**.

Nomos is intentionally opinionated so that:

* humans can reason about it
* AI agents can safely extend it
* systems remain explainable over time

Follow this guide, and changes will almost always align with the platform’s intent.
