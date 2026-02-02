import type { ActionDescriptor, ResourceDefinition, ColumnDef, FieldDef, RowAction } from "./types"
import { Layouts } from "./layouts"
import type { ActionDescriptor, PanelModule } from "./types"
import { panelApiFetch } from "./panel-api"

export type ResourcePanelMode = "list" | "create" | "edit" | "view"

export type ResourcePanelConfig = {
  resource: ResourceDefinition
  mode: ResourcePanelMode
  params?: Record<string, string>
  basePath?: string
}

const getLabels = (resource: ResourceDefinition) => {
  if ("labels" in resource && resource.labels) {
    return resource.labels
  }

  return {
    label: resource.label ?? resource.name,
    labelPlural: resource.labelPlural ?? resource.name,
  }
}

const resolveListKey = (resource: ResourceDefinition) => resource.dataKey ?? resource.name

const resolveSingleKey = (resource: ResourceDefinition) =>
  resource.singleDataKey ?? resource.dataKey ?? resource.name

const interpolateEndpoint = (endpoint: string, params?: Record<string, string>) =>
  endpoint.replace(/\{(\w+)\}/g, (_, key) => params?.[key] ?? "")

const requireEndpoint = (endpoint: string | undefined, label: string) => {
  if (!endpoint) {
    throw new Error(`Missing required endpoint: ${label}`)
  }
  return endpoint
}

const buildListUrl = (
  endpoint: string,
  state: {
    page: number
    pageSize: number
    search?: string
    sort?: { key: string; dir: "asc" | "desc" }
    filters?: Record<string, string | number | boolean | string[]>
  }
) => {
  const url = new URL(endpoint, "http://local")
  url.searchParams.set("page", String(state.page))
  url.searchParams.set("pageSize", String(state.pageSize))
  if (state.search) {
    url.searchParams.set("search", state.search)
  }
  if (state.sort?.key) {
    url.searchParams.set("sort", `${state.sort.key}:${state.sort.dir}`)
  }
  if (state.filters && typeof state.filters === "object") {
    for (const [k, v] of Object.entries(state.filters)) {
      if (v !== undefined && v !== null && v !== "") {
        if (Array.isArray(v)) {
          v.forEach((item) => url.searchParams.append(`filter.${k}`, String(item)))
        } else {
          url.searchParams.set(`filter.${k}`, String(v))
        }
      }
    }
  }
  return `${url.pathname}${url.search}`
}

const unwrapListResponse = (response: any, resource: ResourceDefinition) => {
  const key = resolveListKey(resource)
  const payload = response?.data ?? response ?? {}
  const candidate =
    payload?.[key] ?? response?.[key] ?? payload?.[resource.name] ?? response?.[resource.name] ?? payload
  const items = Array.isArray(candidate) ? candidate : []
  const total = response?.meta?.total ?? response?.total ?? items.length
  return { items, total }
}

const unwrapSingleResponse = (response: any, resource: ResourceDefinition) => {
  const key = resolveSingleKey(resource)
  const payload = response?.data ?? response ?? {}
  const candidate =
    payload?.[key] ?? response?.[key] ?? payload?.[resource.name] ?? response?.[resource.name] ?? payload
  const record = candidate && !Array.isArray(candidate) ? candidate : null
  return { record, key }
}

const resolveFields = (resource: ResourceDefinition, mode: ResourcePanelMode): FieldDef[] => {
  if (resource.form?.fields?.length) {
    return resource.form.fields.filter((field) => {
      if (mode === "create" && field.showOnCreate === false) return false
      if (mode === "edit" && field.showOnEdit === false) return false
      if (mode === "view" && field.showOnView === false) return false
      return true
    })
  }
  if (resource.list?.columns?.length) {
    return resource.list.columns.map((column) => ({
      name: column.key,
      label: column.label,
      type: "text",
    }))
  }
  return []
}

const resolveBulkActions = (
  resource: ResourceDefinition,
  listHref: string
): ActionDescriptor[] => {
  if (resource.list?.bulkActions?.length) {
    return resource.list.bulkActions
  }
  const bulkDeleteEndpoint = resource.endpoints.bulkDelete
  if (bulkDeleteEndpoint) {
    return [
      {
        type: "method",
        label: "Delete selected",
        endpoint: bulkDeleteEndpoint,
        method: "POST",
        intent: resource.intents?.delete,
        confirm: {
          title: "Delete selected items?",
          body: "This action cannot be undone.",
        },
        after: "refresh",
        toast: { success: "Items deleted" },
      },
    ]
  }
  return []
}

const resolveColumns = (resource: ResourceDefinition): ColumnDef[] => {
  if (resource.list?.columns?.length) {
    return resource.list.columns.filter((column) => column.render !== "action")
  }
  if (resource.form?.fields?.length) {
    return resource.form.fields.map((field) => ({
      key: field.name,
      label: field.label,
    }))
  }
  return []
}

export const createResourcePanel = ({
  resource,
  mode,
  params,
  basePath = `/admin/${resource.name}`,
}: ResourcePanelConfig): PanelModule => {
  const panelId = `${resource.name}-${mode}`
  const labels = getLabels(resource)
  const listKey = resolveListKey(resource)
  const singleKey = resolveSingleKey(resource)
  const fields = resolveFields(resource, mode)
  const columns = resolveColumns(resource)
  const serverSideList = resource.list?.serverSide ?? false

  const listHref = basePath
  const createHref = `${basePath}/new`
  const editHref = (id: string) => `${basePath}/${id}/edit`
  const viewHref = (id: string) => `${basePath}/${id}`
  const intents = resource.intents ?? {}
  const rowActionConfig = resource.list?.rowActions
  const getEndpoint = resource.endpoints.get
  const updateEndpoint = resource.endpoints.update
  const deleteEndpoint = resource.endpoints.delete
  // Row actions default to showing only if the corresponding endpoint exists
  const rowActionCandidates: Array<RowAction | null> = [
    (rowActionConfig?.view ?? Boolean(getEndpoint))
      ? { id: "view", label: "View", variant: "secondary", intent: intents.read }
      : null,
    (rowActionConfig?.edit ?? Boolean(updateEndpoint))
      ? { id: "edit", label: "Edit", variant: "secondary", intent: intents.update }
      : null,
    (rowActionConfig?.delete ?? Boolean(deleteEndpoint))
      ? { id: "delete", label: "Delete", variant: "destructive", intent: intents.delete }
      : null,
  ]
  const rowActions = rowActionCandidates.filter((action): action is RowAction => Boolean(action))
  const customRowActions = resource.list?.customRowActions ?? []
  const combinedRowActions = [...rowActions, ...customRowActions]

  const normalizeId = (value?: string | string[] | null) => {
    const raw = Array.isArray(value) ? value[0] : value
    const trimmed = raw?.trim()
    return trimmed ? trimmed : undefined
  }

  const resolveId = (ctxParams: Record<string, string>, ctxQuery?: Record<string, string | string[]>) =>
    normalizeId(params?.id) ??
    normalizeId(ctxParams?.id) ??
    normalizeId(ctxQuery?.id) ??
    normalizeId(params?.["id"])

  const requireId = (id?: string) => {
    if (!id) {
      throw new Error("Missing resource id")
    }
    return id
  }

  const commandBar = (ctxParams: Record<string, string>, ctxQuery?: Record<string, string | string[]>): ActionDescriptor[] => {
    const id = resolveId(ctxParams, ctxQuery)
    switch (mode) {
      case "list":
        return [{ type: "link", label: `New ${labels.label}`, href: createHref, intent: intents.create }]
      case "create":
        return [{ type: "link", label: `Back to ${labels.labelPlural}`, href: listHref, intent: intents.read }]
      case "edit":
        if (!id) {
          return [{ type: "link", label: `Back to ${labels.labelPlural}`, href: listHref, intent: intents.read }]
        }
        {
          const actions: ActionDescriptor[] = [
            { type: "link", label: `View ${labels.label}`, href: viewHref(id), intent: intents.read },
            { type: "link", label: `Back to ${labels.labelPlural}`, href: listHref, intent: intents.read },
          ]
          if (deleteEndpoint) {
            actions.push({
              type: "method",
              label: `Delete ${labels.label}`,
              endpoint: interpolateEndpoint(deleteEndpoint, { id }),
              method: "DELETE",
              intent: intents.delete,
              confirm: {
                title: `Delete ${labels.label}?`,
                body: `This will permanently remove the ${labels.label.toLowerCase()}.`,
              },
              after: "navigate",
              redirectTo: listHref,
              toast: { success: `${labels.label} deleted` },
            })
          }
          return actions
        }
      case "view":
        if (!id) {
          return [{ type: "link", label: `Back to ${labels.labelPlural}`, href: listHref, intent: intents.read }]
        }
        return [
          { type: "link", label: `Edit ${labels.label}`, href: editHref(id), intent: intents.update },
          { type: "link", label: `Back to ${labels.labelPlural}`, href: listHref, intent: intents.read },
        ]
      default:
        return []
    }
  }

  const query: PanelModule["query"] = async (ctx) => {
    if (mode === "list") {
      const listEndpoint = requireEndpoint(resource.endpoints.list, "list")
      const pageSize = serverSideList
        ? ctx.query.pageSize !== undefined
          ? ctx.state.pageSize
          : resource.list?.pageSize ?? ctx.state.pageSize
        : Math.min(resource.list?.pageSize ?? 100, 100)
      const sort = serverSideList
        ? ctx.state.sort ??
          (resource.list?.defaultSort
            ? { key: resource.list.defaultSort.key, dir: resource.list.defaultSort.direction }
            : undefined)
        : undefined
      const url = buildListUrl(listEndpoint, {
        page: serverSideList ? ctx.state.page : 1,
        pageSize,
        search: serverSideList ? ctx.state.search : undefined,
        sort,
        filters: serverSideList ? ctx.state.filters : undefined,
      })
      const response = await panelApiFetch(ctx, url)
      const { items, total } = unwrapListResponse(response, resource)
      return {
        [listKey]: items,
        meta: serverSideList
          ? {
              total,
              page: ctx.state.page,
              pageSize,
            }
          : undefined,
      }
    }

    if (mode === "create") {
      return {
        [singleKey]: {},
      }
    }

    const id = requireId(resolveId(ctx.params, ctx.query) ?? normalizeId(new URL(ctx.url).searchParams.get("id")))
    const endpoint = interpolateEndpoint(requireEndpoint(resource.endpoints.get, "get"), { id })
    const response = await panelApiFetch(ctx, endpoint)
    const { record } = unwrapSingleResponse(response, resource)
    return {
      [singleKey]: record ?? {},
    }
  }

  const layout: PanelModule["layout"] = (data, ctx) => {
    if (mode === "list") {
      return [
        Layouts.rows([
          Layouts.header({
            title: labels.labelPlural,
            subtitle: `Manage ${labels.labelPlural.toLowerCase()}.`,
            requiredIntent: intents.read,
          }),
          Layouts.table({
            key: resource.name,
            title: labels.labelPlural,
            description: `Showing ${labels.labelPlural.toLowerCase()} from ${requireEndpoint(
              resource.endpoints.list,
              "list"
            )}.`,
            rowsKey: listKey,
            paginationKey: serverSideList ? "meta" : undefined,
            serverSide: serverSideList,
            columns,
            rowIdKey: resource.list?.rowIdKey ?? "id",
            enableEdit: false,
            saveEndpoint: resource.endpoints.update,
            saveMethod: "PATCH",
            searchable: resource.list?.searchable ?? true,
            searchPlaceholder: resource.list?.searchPlaceholder,
            sortable: resource.list?.sortable ?? true,
            defaultSort: resource.list?.defaultSort
              ? { key: resource.list.defaultSort.key, dir: resource.list.defaultSort.direction }
              : undefined,
            filters: resource.list?.filters,
            columnVisibility: resource.list?.columnVisibility ?? false,
            bulkActions: resolveBulkActions(resource, listHref),
            rowActions: combinedRowActions.length ? combinedRowActions : undefined,
            rowActionBasePath: basePath,
            rowActionDeleteEndpoint: deleteEndpoint,
            requiredIntent: intents.read,
          }),
        ]),
      ]
    }

    if (mode === "view") {
      return [
        Layouts.rows([
        Layouts.header({
          title: `${labels.label} Details`,
          subtitle: `Viewing ${labels.label.toLowerCase()} information.`,
          requiredIntent: intents.read,
        }),
        Layouts.card({
          title: labels.label,
          description: `Details from ${requireEndpoint(resource.endpoints.get, "get")}.`,
          requiredIntent: intents.read,
          nodes: fields.map((field) =>
            Layouts.stat({
              label: field.label,
              valueKey: `${singleKey}.${field.name}`,
            })
          ),
          }),
        ]),
      ]
    }

    const isCreate = mode === "create"
    const formTitle = isCreate ? `Create ${labels.label}` : `Edit ${labels.label}`
    const submitLabel = isCreate ? `Create ${labels.label}` : `Save ${labels.label}`
    const id = isCreate
      ? undefined
      : requireId(resolveId(ctx.params, ctx.query) ?? normalizeId(new URL(ctx.url).searchParams.get("id")))
    const endpoint = isCreate
      ? requireEndpoint(resource.endpoints.create, "create")
      : interpolateEndpoint(requireEndpoint(resource.endpoints.update, "update"), { id: requireId(id) })

    return [
      Layouts.rows([
        Layouts.header({
          title: formTitle,
          subtitle:
            isCreate
              ? `Add a new ${labels.label.toLowerCase()}.`
              : `Update ${labels.label.toLowerCase()} details.`,
          requiredIntent: isCreate ? intents.create : intents.update,
        }),
        Layouts.form({
          id: `${resource.name}-${mode}-form`,
          title: formTitle,
          description:
            isCreate
              ? `Create a new ${labels.label.toLowerCase()} record.`
              : `Edit the ${labels.label.toLowerCase()} record.`,
          schema: resource.schema,
          fields,
          submitLabel,
          submitEndpoint: endpoint,
          submitMethod: isCreate ? "POST" : "PATCH",
          initialValuesKey: singleKey,
          after: "navigate",
          redirectTo: isCreate ? listHref : viewHref(requireId(id)),
          requiredIntent: isCreate ? intents.create : intents.update,
        }),
      ]),
    ]
  }

  return {
    id: panelId,
    title: labels.labelPlural,
    subtitle: labels.label,
    query,
    layout,
    commandBar: (ctx) => commandBar(ctx.params, ctx.query),
  }
}
