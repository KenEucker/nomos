/**
 * Compile Resource Definitions to Page Modules
 *
 * This module compiles AdminResource definitions into default page modules
 * for List, Form, and Show views. These compiled modules can be used directly
 * or overridden by handwritten modules for complex workflows.
 */

import { apiGet, apiPost, apiPatch, apiDelete } from "../api";
import type { AdminResource } from "../resources/types";
import { resolveEndpoint, getFieldsForView } from "../resources/types";
import type {
  ListPageModule,
  FormPageModule,
  ShowPageModule,
  ListQueryParams,
  ListQueryResult,
  CustomAction,
} from "./types";

function requireEndpoint(resource: AdminResource, key: keyof AdminResource["endpoints"]): string {
  const endpoint = resource.endpoints[key];
  if (!endpoint) {
    throw new Error(`Missing required endpoint "${key}" for resource "${resource.id}".`);
  }
  return endpoint;
}

// ============================================================================
// List Module Compiler
// ============================================================================

export function compileListModule<T = unknown>(
  resource: AdminResource
): ListPageModule<T> {
  const listEndpoint = requireEndpoint(resource, "list");
  const canDelete = resource.actions?.delete !== false;
  const customActions = resource.actions?.custom ?? [];

  return {
    resourceId: resource.id,
    view: "List",
    title: resource.labelPlural,
    subtitle: `Manage ${resource.labelPlural.toLowerCase()}`,

    query: {
      list: async (params?: ListQueryParams): Promise<ListQueryResult<T>> => {
        const queryParams = new URLSearchParams();

        if (params?.page !== undefined) {
          queryParams.set("page", String(params.page));
        }
        if (params?.pageSize !== undefined) {
          queryParams.set("pageSize", String(params.pageSize));
        }
        if (params?.sort) {
          queryParams.set("sort", params.sort);
        }
        if (params?.sortDir) {
          queryParams.set("sortDir", params.sortDir);
        }
        if (params?.search) {
          queryParams.set("search", params.search);
        }

        // Add filter params
        if (params?.filters) {
          for (const [key, value] of Object.entries(params.filters)) {
            if (value !== undefined && value !== null && value !== "") {
              queryParams.set(key, String(value));
            }
          }
        }

        const queryString = queryParams.toString();
        const url = queryString
          ? `${listEndpoint}?${queryString}`
          : listEndpoint;

        const response = await apiGet<Record<string, T[]>>(url);

        // Extract items from response using dataKey
        const dataKey = resource.dataKey ?? resource.id;
        const items = (response.data?.[dataKey] ?? response.data ?? []) as T[];

        return {
          items,
          total: response.meta?.total ?? items.length,
          page: response.meta?.page ?? params?.page ?? 1,
          pageSize: response.meta?.pageSize ?? params?.pageSize ?? 10,
        };
      },
    },

    actions: {
      delete: canDelete
        ? async (id: string): Promise<void> => {
            const deleteEndpoint = requireEndpoint(resource, "delete");
            const url = resolveEndpoint(deleteEndpoint, id);
            await apiDelete(url);
          }
        : undefined,

      custom: customActions.map((action): CustomAction => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        variant: action.variant,
        confirm: action.confirm,
        execute: async (id: string) => {
          const endpoint =
            typeof action.endpoint === "function"
              ? action.endpoint(id)
              : resolveEndpoint(action.endpoint!, id);

          const method = action.method ?? "POST";

          switch (method) {
            case "DELETE":
              return apiDelete(endpoint);
            case "PATCH":
              return apiPatch(endpoint, {});
            case "PUT":
              return apiPatch(endpoint, {});
            default:
              return apiPost(endpoint, {});
          }
        },
      })),
    },

    list: {
      columns: resource.list.columns,
      defaultSort: resource.list.defaultSort,
      filters: resource.list.filters,
      searchable: resource.list.searchable ?? false,
      searchPlaceholder: resource.list.searchPlaceholder ?? `Search ${resource.labelPlural.toLowerCase()}...`,
      pageSize: resource.list.pageSize ?? 10,
    },

    navigation: {
      viewUrl: (id: string) => `${resource.routeBase}/${id}`,
      editUrl: (id: string) => `${resource.routeBase}/${id}/edit`,
      createUrl: () => `${resource.routeBase}/new`,
    },

    onError: ({ error }) => {
      const message =
        error instanceof Error ? error.message : "An error occurred";
      return message;
    },

    onSuccess: () => {
      return "Operation completed successfully";
    },
  };
}

// ============================================================================
// Form Module Compiler
// ============================================================================

export function compileFormModule<T = unknown>(
  resource: AdminResource
): FormPageModule<T> {
  const canCreate = resource.actions?.create !== false;
  const canUpdate = resource.actions?.update !== false;
  const getEndpoint = resource.endpoints.get;
  const createEndpoint = resource.endpoints.create;
  const updateEndpoint = resource.endpoints.update;

  return {
    resourceId: resource.id,
    view: "Form",
    title: resource.label,

    query: {
      get: async (id: string): Promise<T> => {
        if (!getEndpoint) {
          throw new Error(`Missing required endpoint "get" for resource "${resource.id}".`);
        }
        const url = resolveEndpoint(getEndpoint, id);
        const response = await apiGet<Record<string, T>>(url);

        // Extract item from response using singleDataKey
        const dataKey = resource.singleDataKey ?? resource.id.replace(/s$/, "");
        return (response.data?.[dataKey] ?? response.data) as T;
      },
    },

    actions: {
      create: canCreate
        ? async (payload: Record<string, unknown>): Promise<T> => {
            if (!createEndpoint) {
              throw new Error(
                `Missing required endpoint "create" for resource "${resource.id}".`
              );
            }
            const response = await apiPost<Record<string, T>>(
              createEndpoint,
              payload
            );
            const dataKey = resource.singleDataKey ?? resource.id.replace(/s$/, "");
            return (response.data?.[dataKey] ?? response.data) as T;
          }
        : undefined,

      update: canUpdate
        ? async (id: string, payload: Record<string, unknown>): Promise<T> => {
            if (!updateEndpoint) {
              throw new Error(
                `Missing required endpoint "update" for resource "${resource.id}".`
              );
            }
            const url = resolveEndpoint(updateEndpoint, id);
            const response = await apiPatch<Record<string, T>>(url, payload);
            const dataKey = resource.singleDataKey ?? resource.id.replace(/s$/, "");
            return (response.data?.[dataKey] ?? response.data) as T;
          }
        : undefined,
    },

    form: {
      fields: resource.form.fields,
    },

    navigation: {
      listUrl: () => resource.routeBase,
      viewUrl: (id: string) => `${resource.routeBase}/${id}`,
    },

    onError: ({ error }) => {
      // Check for validation errors from backend
      if (error && typeof error === "object" && "details" in error) {
        const details = (error as any).details;
        if (Array.isArray(details)) {
          return details.map((d: any) => ({
            field: d.path?.[0] ?? d.field,
            message: d.message ?? String(d),
          }));
        }
      }

      const message =
        error instanceof Error ? error.message : "An error occurred";
      return message;
    },

    onSuccess: ({ context }) => {
      const mode = (context as any).mode ?? "create";
      return mode === "create"
        ? `${resource.label} created successfully`
        : `${resource.label} updated successfully`;
    },
  };
}

// ============================================================================
// Show Module Compiler
// ============================================================================

export function compileShowModule<T = unknown>(
  resource: AdminResource
): ShowPageModule<T> {
  const canDelete = resource.actions?.delete !== false;
  const customActions = resource.actions?.custom ?? [];
  const getEndpoint = resource.endpoints.get;
  const deleteEndpoint = resource.endpoints.delete;

  return {
    resourceId: resource.id,
    view: "Show",
    title: resource.label,

    query: {
      get: async (id: string): Promise<T> => {
        if (!getEndpoint) {
          throw new Error(`Missing required endpoint "get" for resource "${resource.id}".`);
        }
        const url = resolveEndpoint(getEndpoint, id);
        const response = await apiGet<Record<string, T>>(url);

        // Extract item from response using singleDataKey
        const dataKey = resource.singleDataKey ?? resource.id.replace(/s$/, "");
        return (response.data?.[dataKey] ?? response.data) as T;
      },
    },

    actions: {
      delete: canDelete
        ? async (id: string): Promise<void> => {
            if (!deleteEndpoint) {
              throw new Error(
                `Missing required endpoint "delete" for resource "${resource.id}".`
              );
            }
            const url = resolveEndpoint(deleteEndpoint, id);
            await apiDelete(url);
          }
        : undefined,

      custom: customActions.map((action): CustomAction => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        variant: action.variant,
        confirm: action.confirm,
        execute: async (id: string) => {
          const endpoint =
            typeof action.endpoint === "function"
              ? action.endpoint(id)
              : resolveEndpoint(action.endpoint!, id);

          const method = action.method ?? "POST";

          switch (method) {
            case "DELETE":
              return apiDelete(endpoint);
            case "PATCH":
              return apiPatch(endpoint, {});
            case "PUT":
              return apiPatch(endpoint, {});
            default:
              return apiPost(endpoint, {});
          }
        },
      })),
    },

    fields: getFieldsForView(resource, "view"),

    navigation: {
      listUrl: () => resource.routeBase,
      editUrl: (id: string) => `${resource.routeBase}/${id}/edit`,
    },

    onError: ({ error }) => {
      const message =
        error instanceof Error ? error.message : "An error occurred";
      return message;
    },

    onSuccess: () => {
      return `${resource.label} deleted successfully`;
    },
  };
}

// ============================================================================
// Helper: Compile All Modules for a Resource
// ============================================================================

export interface CompiledModules<T = unknown> {
  list: ListPageModule<T>;
  form: FormPageModule<T>;
  show: ShowPageModule<T>;
}

export function compileAllModules<T = unknown>(
  resource: AdminResource
): CompiledModules<T> {
  return {
    list: compileListModule<T>(resource),
    form: compileFormModule<T>(resource),
    show: compileShowModule<T>(resource),
  };
}
