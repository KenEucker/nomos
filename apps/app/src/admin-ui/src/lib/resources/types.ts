/**
 * Admin Resource Framework - Type Definitions
 *
 * This module defines the types for the admin CRUD resource system.
 * Resources are declarative definitions that drive automatic UI generation.
 */

/**
 * Field types supported by the form renderer
 */
export type FieldType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "boolean"
  | "textarea"
  | "datetime"
  | "date"
  | "enum"
  | "json"
  | "relation"
  | "relation_many";

/**
 * Base field definition
 */
export interface BaseFieldDef {
  /** Field name (matches API property) */
  name: string;
  /** Display label */
  label: string;
  /** Field type */
  type: FieldType;
  /** Whether the field is required */
  required?: boolean;
  /** Help text shown below the field */
  help?: string;
  /** Whether the field is read-only */
  readonly?: boolean;
  /** Whether to show this field in create form */
  showOnCreate?: boolean;
  /** Whether to show this field in edit form */
  showOnEdit?: boolean;
  /** Whether to show this field in detail view */
  showOnView?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Default value */
  defaultValue?: unknown;
  /** Optional transform applied before submit */
  submitTransform?: (value: unknown) => unknown;
}

/**
 * Text field definition
 */
export interface TextFieldDef extends BaseFieldDef {
  type: "text" | "email" | "password";
  minLength?: number;
  maxLength?: number;
}

/**
 * Number field definition
 */
export interface NumberFieldDef extends BaseFieldDef {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Textarea field definition
 */
export interface TextareaFieldDef extends BaseFieldDef {
  type: "textarea";
  rows?: number;
}

/**
 * Enum/Select field definition
 */
export interface EnumFieldDef extends BaseFieldDef {
  type: "enum";
  options: Array<{ value: string; label: string }>;
}

/**
 * JSON field definition
 */
export interface JsonFieldDef extends BaseFieldDef {
  type: "json";
  rows?: number;
}

/**
 * Relation field definition (many-to-one / one-to-one)
 */
export interface RelationFieldDef extends BaseFieldDef {
  type: "relation";
  /** Resource ID to fetch options from */
  relationResource: string;
  /** Field to use as the option value (usually "id") */
  valueKey: string;
  /** Field to use as the display label */
  labelKey: string;
  /** Optional endpoint to fetch options (defaults to resource list endpoint) */
  optionsEndpoint?: string;
}

/**
 * Many-to-many relation field definition
 */
export interface RelationManyFieldDef extends BaseFieldDef {
  type: "relation_many";
  /** Resource ID to fetch options from */
  relationResource: string;
  /** Field to use as the option value (usually "id") */
  valueKey: string;
  /** Field to use as the display label */
  labelKey: string;
  /** Optional endpoint to fetch options */
  optionsEndpoint?: string;
}

/**
 * Union of all field definitions
 */
export type FieldDef =
  | TextFieldDef
  | NumberFieldDef
  | TextareaFieldDef
  | EnumFieldDef
  | JsonFieldDef
  | RelationFieldDef
  | RelationManyFieldDef
  | (BaseFieldDef & { type: "boolean" | "datetime" | "date" });

/**
 * Column definition for list views
 */
export interface ColumnDef {
  /** Field key to display */
  key: string;
  /** Column header label */
  label: string;
  /** Whether the column is sortable */
  sortable?: boolean;
  /** Custom render type */
  render?: "text" | "badge" | "date" | "datetime" | "boolean" | "json" | "link" | "email";
  /** For badge render: variant based on value */
  badgeVariants?: Record<string, string>;
  /** For link render: URL template with {value} placeholder */
  linkTemplate?: string;
  /** Width hint */
  width?: string;
  /** Whether to show on mobile */
  hideOnMobile?: boolean;
}

/**
 * Action permissions for a resource
 */
export interface ResourceActions {
  /** Allow creating new records */
  create?: boolean;
  /** Allow viewing record details */
  view?: boolean;
  /** Allow editing records */
  update?: boolean;
  /** Allow deleting records */
  delete?: boolean;
  /** Custom actions */
  custom?: Array<{
    id: string;
    label: string;
    icon?: string;
    variant?: string;
    /** Confirmation message (if set, shows confirm dialog) */
    confirm?: string;
    /** Endpoint to call (method defaults to POST) */
    endpoint: string | ((id: string) => string);
    method?: "POST" | "PATCH" | "PUT" | "DELETE";
  }>;
}

/**
 * Filter definition for list views
 */
export interface FilterDef {
  /** Filter key (query param name) */
  key: string;
  /** Display label */
  label: string;
  /** Filter type */
  type: "text" | "enum" | "boolean" | "date_range";
  /** For enum type: available options */
  options?: Array<{ value: string; label: string }>;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Admin Resource Input Definition
 *
 * This is the author-facing type. It allows partial definitions that are
 * normalized into a fully specified AdminResource.
 */
export interface AdminResourceInput {
  /** Unique resource identifier (e.g., "users") */
  id: string;

  /** Display name (singular, e.g., "User") */
  label?: string;

  /** Plural display name (e.g., "Users") */
  labelPlural?: string;

  /** Base route in admin UI (e.g., "/admin/users") */
  routeBase?: string;

  /** Primary key field name (usually "id") */
  primaryKey?: string;

  /** Navigation order (lower appears first) */
  menuOrder?: number;

  /** Full SVG markup string for navigation (optional) */
  icon?: string;

  /** API endpoints */
  endpoints?: {
    /** List endpoint (GET) */
    list?: string;
    /** Get single record endpoint (GET) - use {id} placeholder */
    get?: string;
    /** Create endpoint (POST) */
    create?: string;
    /** Update endpoint (PATCH/PUT) - use {id} placeholder */
    update?: string;
    /** Delete endpoint (DELETE) - use {id} placeholder */
    delete?: string;
  };

  /** List view configuration */
  list?: {
    /** Columns to display */
    columns?: ColumnDef[];
    /** Default sort configuration */
    defaultSort?: {
      key: string;
      dir: "asc" | "desc";
    };
    /** Available filters */
    filters?: FilterDef[];
    /** Enable search */
    searchable?: boolean;
    /** Search placeholder */
    searchPlaceholder?: string;
    /** Items per page */
    pageSize?: number;
  };

  /** Form configuration */
  form?: {
    /** Field definitions */
    fields?: FieldDef[];
  };

  /** Actions allowed on this resource */
  actions?: ResourceActions;

  /** Required role to access this resource */
  requiredRole?: string;

  /** Required permission to access this resource */
  requiredPermission?: string;

  /** Response data key (e.g., "users" for { users: [...] }) */
  dataKey?: string;

  /** Single record data key (e.g., "user" for { user: {...} }) */
  singleDataKey?: string;
}

/**
 * Admin Resource Definition
 *
 * This is the main configuration object that defines how a resource
 * is displayed and managed in the admin UI.
 */
export interface AdminResource {
  /** Unique resource identifier (e.g., "users") */
  id: string;

  /** Display name (singular, e.g., "User") */
  label: string;

  /** Plural display name (e.g., "Users") */
  labelPlural: string;

  /** Base route in admin UI (e.g., "/admin/users") */
  routeBase: string;

  /** Primary key field name (usually "id") */
  primaryKey: string;

  /** Navigation order (lower appears first) */
  menuOrder?: number;

  /** Full SVG markup string for navigation (optional) */
  icon?: string;

  /** API endpoints */
  endpoints: {
    /** List endpoint (GET) */
    list?: string;
    /** Get single record endpoint (GET) - use {id} placeholder */
    get?: string;
    /** Create endpoint (POST) */
    create?: string;
    /** Update endpoint (PATCH/PUT) - use {id} placeholder */
    update?: string;
    /** Delete endpoint (DELETE) - use {id} placeholder */
    delete?: string;
  };

  /** List view configuration */
  list: {
    /** Columns to display */
    columns: ColumnDef[];
    /** Default sort configuration */
    defaultSort?: {
      key: string;
      dir: "asc" | "desc";
    };
    /** Available filters */
    filters?: FilterDef[];
    /** Enable search */
    searchable?: boolean;
    /** Search placeholder */
    searchPlaceholder?: string;
    /** Items per page */
    pageSize?: number;
  };

  /** Form configuration */
  form: {
    /** Field definitions */
    fields: FieldDef[];
  };

  /** Actions allowed on this resource */
  actions?: ResourceActions;

  /** Required role to access this resource */
  requiredRole?: string;

  /** Required permission to access this resource */
  requiredPermission?: string;

  /** Response data key (e.g., "users" for { users: [...] }) */
  dataKey?: string;

  /** Single record data key (e.g., "user" for { user: {...} }) */
  singleDataKey?: string;
}

/**
 * Normalize a resource input into a fully specified AdminResource.
 */
export function normalizeResource(input: AdminResourceInput): AdminResource {
  const label = input.label ?? toTitleCase(input.id);
  const labelPlural = input.labelPlural ?? `${label}s`;
  const endpoints = input.endpoints ?? {};

  return {
    id: input.id,
    label,
    labelPlural,
    routeBase: input.routeBase ?? `/admin/${input.id}`,
    primaryKey: input.primaryKey ?? "id",
    menuOrder: input.menuOrder,
    icon: input.icon,
    endpoints: {
      list: endpoints.list,
      get: endpoints.get,
      create: endpoints.create,
      update: endpoints.update,
      delete: endpoints.delete,
    },
    list: {
      columns: input.list?.columns ?? [],
      defaultSort: input.list?.defaultSort,
      filters: input.list?.filters,
      searchable: input.list?.searchable,
      searchPlaceholder: input.list?.searchPlaceholder,
      pageSize: input.list?.pageSize,
    },
    form: {
      fields: input.form?.fields ?? [],
    },
    actions: {
      ...input.actions,
      create: input.actions?.create ?? Boolean(endpoints.create),
      view: input.actions?.view ?? Boolean(endpoints.get),
      update: input.actions?.update ?? Boolean(endpoints.update),
      delete: input.actions?.delete ?? Boolean(endpoints.delete),
    },
    requiredRole: input.requiredRole,
    requiredPermission: input.requiredPermission,
    dataKey: input.dataKey,
    singleDataKey: input.singleDataKey,
  };
}

function toTitleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Helper function to replace {id} placeholder in endpoint strings
 */
export function resolveEndpoint(endpoint: string, id: string): string {
  return endpoint.replace("{id}", id);
}

/**
 * Helper to get field definition by name
 */
export function getFieldByName(resource: AdminResource, name: string): FieldDef | undefined {
  return resource.form.fields.find((f) => f.name === name);
}

/**
 * Helper to get fields for a specific view
 */
export function getFieldsForView(
  resource: AdminResource,
  view: "create" | "edit" | "view"
): FieldDef[] {
  return resource.form.fields.filter((field) => {
    if (view === "create") {
      return field.showOnCreate !== false;
    }
    if (view === "edit") {
      return field.showOnEdit !== false;
    }
    return field.showOnView !== false;
  });
}
