# Nomos UI Specification (Nomos-UI)

**Status:** Active Draft (Proposed Additions for Orchid Parity)
**Version:** 0.1.3
**Audience:** Framework users, UI contributors, plugin authors
**Scope:** Defines Nomos-UI, Panels, PanelModules, ResourceDefinitions, and UI generation

---

## 1. Overview

Nomos-UI is the **frontend framework and runtime surface** of the Nomos platform.

It is responsible for rendering administrative and control interfaces that are:

* declarative
* policy-aware
* accessible by default
* observable
* capable of simultaneous server-side rendering (SSR) and client-side rendering (CSR)

Nomos-UI is not a theme layer or a page builder. It is a structured UI runtime that executes against platform-defined contracts.

---

## 2. Design Goals

### 2.1 Declarative UI Construction

UI behavior is described through **PanelModules** and **Resource Definitions**, not imperative UI wiring.

The UI surface is derived from:

* schemas
* policies
* actions
* platform contracts

---

### 2.2 First-Class SSR + CSR

Nomos-UI supports:

* server-side rendering for fast initial paint
* client-side hydration for interactivity
* long-lived client-side navigation when appropriate

SSR and CSR are not mutually exclusive modes. Panels may participate in both simultaneously.

---

### 2.3 Accessibility by Default

All built-in components and generated interfaces:

* meet accessibility standards
* expose semantic structure
* support keyboard navigation

Accessibility is a platform guarantee, not an optional enhancement.

---

## 3. Core UI Abstractions

*(unchanged)*

---

## 4. Resource Definitions

*(unchanged)*

---

## 5. Pages

*(unchanged)*

---

## 6. Layout and Composition

Panels may be:

* stacked
* nested
* rendered conditionally
* embedded in modals or secondary surfaces

Layout decisions are separate from panel definitions and may be applied at runtime.

### 6.1 Layout Nodes

Nomos-UI defines a fixed set of **layout nodes** used by both PanelModules and resource-generated panels.

Existing layout nodes include:

* rows
* columns
* card
* header
* table
* form
* fieldset
* text
* stat
* iframe

The following layout nodes are **added for Orchid parity**:

#### Tabs

A **tabs** layout node groups child layouts into labeled tabbed sections.

* Tabs may contain arbitrary layout nodes
* Tabs may be conditionally visible based on intent
* Tab state may be client-managed

#### Modal

A **modal** layout node represents a secondary surface that overlays the current panel.

* Modals may contain full layouts (forms, tables, cards)
* Modals are opened via actions
* Modals may submit actions and trigger refresh or navigation

Modals are part of the same layout system and do not introduce a separate rendering model.

---

## 7. Data Flow

*(unchanged)*

---

## 8. Actions

Panels may define actions that:

* invoke platform services
* mutate resources via API
* trigger navigation
* open or close modals
* trigger partial or full refreshes

### 8.1 Action Surfaces

Actions may appear in:

* panel command bars
* table row actions
* table bulk actions
* form primary or secondary actions

### 8.2 Bulk Actions

Tables may define **bulk actions** that operate on selected rows.

Bulk actions:

* are policy-checked
* receive selected row identifiers
* may invoke destructive or non-destructive operations

---

## 9. Tables

Tables are first-class **data grid** components.

In addition to existing functionality, tables support:

* column sorting (client or server driven)
* default sort configuration
* field-based filters
* column visibility toggles
* row selection
* bulk actions
* consistent empty, loading, and error states

These capabilities apply equally to custom panel tables and resource-generated CRUD tables.

---

## 10. Metrics and Visualization

Nomos-UI supports metric-oriented layouts for dashboards and observability.

### 10.1 Stat Nodes

Stat nodes display:

* single values
* counters
* derived aggregates

### 10.2 Chart Nodes

The following chart layout nodes are added for Orchid parity:

* line charts
* bar charts
* pie/donut charts

Charts:

* bind to panel data keys
* may be time-series or categorical
* respect intent-based visibility

Charts are layout primitives and do not define data aggregation logic themselves.

---

## 11. Policy Awareness

*(unchanged)*

---

## 12. Error Handling

*(unchanged)*

---

## 13. Extensibility

*(unchanged)*

---

## 14. Non-Goals

*(unchanged)*

---

## 15. Summary

Nomos-UI remains:

* code-first for custom panels
* data-first for resource-driven CRUD
* policy-aware and observable by default

The additions in this document:

* do **not** introduce new core abstractions
* do **not** require layout serialization
* do **not** change PanelModule or ResourceDefinition roles

They strictly expand the **layout and interaction feature set** to reach full parity with Laravel Orchid’s UI system.
