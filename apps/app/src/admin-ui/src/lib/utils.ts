import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type {
  ResourceDefinitionPartial,
  ResourceDefinition,
  ResourceEndpointValue,
} from "./types";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

const titleCase = (value: string) =>
  value
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())

const pluralize = (value: string) => (value.endsWith("s") ? value : `${value}s`)

export const createResourceDefinition = (input: ResourceDefinitionPartial): ResourceDefinition => {
  const derivedLabel = titleCase(input.name)
  const derivedLabelPlural = pluralize(derivedLabel)
  const baseEndpoint = `/${input.name}`
  const idEndpoint = `${baseEndpoint}/{id}`
  const resolveEndpoint = (value: ResourceEndpointValue | undefined, fallback: string) => {
    if (value === true) return fallback
    return value
  }

  // Resolve labels union:
  // - If input.labels exists, use it
  // - Else use input.label/labelPlural
  // - Else derive from name
  const resolved =
    "labels" in input && input.labels
      ? { labels: { label: input.labels.label, labelPlural: input.labels.labelPlural } }
      : {
          label: input.label ?? derivedLabel,
          labelPlural: input.labelPlural ?? derivedLabelPlural,
        }

  return {
    name: input.name,

    endpoints: {
      list: resolveEndpoint(input.endpoints?.list, baseEndpoint),
      get: resolveEndpoint(input.endpoints?.get, idEndpoint),
      create: resolveEndpoint(input.endpoints?.create, baseEndpoint),
      update: resolveEndpoint(input.endpoints?.update, idEndpoint),
      delete: resolveEndpoint(input.endpoints?.delete, idEndpoint),
    },

    ...resolved,

    menu: input.menu
      ? {
          group: input.menu.group,
          order: input.menu.order ?? -1,
          icon: input.menu.icon,
        }
      : undefined,

    list: input.list
      ? {
          columns: input.list.columns ?? [],
          rowIdKey: input.list.rowIdKey,
          defaultSort: input.list.defaultSort,
          searchable: input.list.searchable,
          searchPlaceholder: input.list.searchPlaceholder,
          pageSize: input.list.pageSize ?? 20,
          rowActions: input.list.rowActions,
          customRowActions: input.list.customRowActions,
        }
      : undefined,

    form: input.form
      ? {
          fields: input.form.fields,
        }
      : undefined,

    schema: input.schema,
    requiredPermission: input.requiredPermission,
    intents: input.intents,
    dataKey: input.dataKey,
    singleDataKey: input.singleDataKey,
  }
}
