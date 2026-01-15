/**
 * Page Module Types
 *
 * Page modules are the rendering contract between resource definitions and templates.
 * They represent a single admin view (List, Form, or Show) and expose:
 * - Query functions for data fetching
 * - Action functions for mutations
 * - Layout and UI composition
 *
 * Page modules can be:
 * 1. Generated automatically from resource definitions (default)
 * 2. Handwritten for complex workflows (override)
 */

import type { z } from "zod";
import type { Component } from "svelte";
import type { AdminResource, ColumnDef, FieldDef, FilterDef, SummaryCardDef } from "../resources/types";

// ============================================================================
// View Types
// ============================================================================

export type ViewType = "List" | "Form" | "Show";
export type FormMode = "create" | "edit";

// ============================================================================
// Query Functions
// ============================================================================

export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  sortDir?: "asc" | "desc";
  search?: string;
  filters?: Record<string, unknown>;
}

export interface ListQueryResult<T = unknown> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListQuery<T = unknown> {
  list: (params?: ListQueryParams) => Promise<ListQueryResult<T>>;
}

export interface GetQuery<T = unknown> {
  get: (id: string) => Promise<T>;
}

// ============================================================================
// Action Functions
// ============================================================================

export interface CreateAction<T = unknown> {
  create: (payload: Record<string, unknown>) => Promise<T>;
}

export interface UpdateAction<T = unknown> {
  update: (id: string, payload: Record<string, unknown>) => Promise<T>;
}

export interface DeleteAction {
  delete: (id: string) => Promise<void>;
}

export interface CustomAction {
  id: string;
  label: string;
  icon?: string;
  variant?: string;
  confirm?: string;
  execute: (id: string) => Promise<unknown>;
}

// ============================================================================
// Context Types
// ============================================================================

export interface PageContext {
  /** Current user session info */
  user?: { id: string; name?: string; roles?: string[] };
  /** Current URL params */
  params: Record<string, string>;
  /** Query string params */
  query: Record<string, string>;
}

export interface FormContext extends PageContext {
  mode: FormMode;
  id?: string;
}

export interface ListContext extends PageContext {
  filters: Record<string, unknown>;
  sort?: { key: string; dir: "asc" | "desc" };
  search?: string;
  page: number;
}

// ============================================================================
// Error and Success Handling
// ============================================================================

export interface ValidationError {
  field?: string;
  message: string;
}

export interface PageBreadcrumb {
  label: string;
  href?: string;
}

export interface PageAction {
  label: string;
  href: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
}

export interface ErrorContext {
  error: Error | unknown;
  context: PageContext;
}

export interface SuccessContext<T = unknown> {
  result: T;
  context: PageContext;
}

// ============================================================================
// Base Page Module Interface
// ============================================================================

export interface BasePageModule {
  /** Resource identifier */
  resourceId: string;

  /** View type: List, Form, or Show */
  view: ViewType;

  /** Page title */
  title: string;

  /** Optional subtitle */
  subtitle?: string;

  /** Optional breadcrumbs for the page header */
  breadcrumbs?: PageBreadcrumb[];

  /** Optional page-level actions */
  pageActions?: PageAction[];

  /** Optional Zod schema for validation */
  schema?: z.ZodTypeAny;

  /** Error handler for toast/inline messages */
  onError?: (ctx: ErrorContext) => ValidationError[] | string | void;

  /** Success handler for toast messages */
  onSuccess?: <T>(ctx: SuccessContext<T>) => string | void;
}

// ============================================================================
// List Page Module
// ============================================================================

export interface ListPageModule<T = unknown> extends BasePageModule {
  view: "List";

  /** Query functions */
  query: ListQuery<T>;

  /** Optional delete action */
  actions?: {
    delete?: DeleteAction["delete"];
    custom?: CustomAction[];
  };

  /** List configuration */
  list: {
    columns: ColumnDef[];
    defaultSort?: { key: string; dir: "asc" | "desc" };
    filters?: FilterDef[];
    searchable?: boolean;
    searchPlaceholder?: string;
    pageSize?: number;
    summaryCards?: ListSummaryCardConfig;
    sections?: ListSection[];
  };

  /** Navigation helpers (can be provided by templates) */
  navigation?: {
    /** Get URL for viewing a record */
    viewUrl?: (id: string) => string;
    /** Get URL for editing a record */
    editUrl?: (id: string) => string;
    /** Get URL for creating a new record */
    createUrl?: () => string;
  };

  /** Custom command bar component (optional override) */
  commandBar?: Component;

  /** Custom layout component (optional override) */
  layout?: Component;
}

export interface ListSummaryCardConfig extends SummaryCardDef {
  dataKey?: string;
}

export interface ListSection {
  id: string;
  title: string;
  description?: string;
  columns: ColumnDef[];
  dataKey: string;
  emptyMessage?: string;
}

// ============================================================================
// Form Page Module
// ============================================================================

export interface FormPageModule<T = unknown> extends BasePageModule {
  view: "Form";

  /** Query functions for edit mode */
  query?: {
    get: GetQuery<T>["get"];
  };

  /** Form actions */
  actions: {
    create?: CreateAction<T>["create"];
    update?: UpdateAction<T>["update"];
  };

  /** Form configuration */
  form: {
    fields: FieldDef[];
  };

  /** Navigation helpers */
  navigation?: {
    /** URL to return to after success */
    listUrl?: () => string;
    /** URL to view record after creation */
    viewUrl?: (id: string) => string;
  };

  /** Custom command bar component (optional override) */
  commandBar?: Component;

  /** Custom layout component (optional override) */
  layout?: Component;
}

// ============================================================================
// Show Page Module
// ============================================================================

export interface ShowPageModule<T = unknown> extends BasePageModule {
  view: "Show";

  /** Query function */
  query: {
    get: GetQuery<T>["get"];
  };

  /** Optional actions */
  actions?: {
    delete?: DeleteAction["delete"];
    custom?: CustomAction[];
  };

  /** Field definitions for display */
  fields: FieldDef[];

  /** Navigation helpers */
  navigation?: {
    /** URL to return to list */
    listUrl?: () => string;
    /** URL to edit record */
    editUrl?: (id: string) => string;
  };

  /** Custom command bar component (optional override) */
  commandBar?: Component;

  /** Custom layout component (optional override) */
  layout?: Component;
}

// ============================================================================
// Union Type
// ============================================================================

export type PageModule<T = unknown> =
  | ListPageModule<T>
  | FormPageModule<T>
  | ShowPageModule<T>;

// ============================================================================
// Type Guards
// ============================================================================

export function isListModule(module: PageModule): module is ListPageModule {
  return module.view === "List";
}

export function isFormModule(module: PageModule): module is FormPageModule {
  return module.view === "Form";
}

export function isShowModule(module: PageModule): module is ShowPageModule {
  return module.view === "Show";
}

// ============================================================================
// Template Props Contract
// ============================================================================

/**
 * Props passed from page wrappers to templates
 */
export interface TemplateProps<M extends PageModule = PageModule> {
  /** The resolved page module */
  module: M;

  /** The underlying resource definition (optional, for reference) */
  resource?: AdminResource;

  /** Route parameters */
  params: {
    id?: string;
    mode?: FormMode;
  };

  /** Callbacks for navigation (full-page mode) */
  onNavigate?: (to: string) => void;

  /** Callbacks for modal mode */
  onOpenModal?: (view: ViewType, id?: string, mode?: FormMode) => void;
  onCloseModal?: () => void;

  /** Success callback (for both full-page and modal) */
  onSuccess?: (result?: unknown) => void;

  /** Error callback */
  onError?: (error: Error | unknown) => void;
}

export interface ListTemplateProps extends TemplateProps<ListPageModule> {}
export interface FormTemplateProps extends TemplateProps<FormPageModule> {}
export interface ShowTemplateProps extends TemplateProps<ShowPageModule> {}
