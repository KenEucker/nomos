<!--
  Supports list responses shaped as: { data: { [dataKey]: [] }, meta: { total } },
  { [dataKey]: [], total }, { data: [], meta: { total } }, { data: [] }, or [].
  Query params: page, pageSize, search (when provided), sort=key:dir.
-->
<script lang="ts">
  import { onMount } from "svelte"
  import { navigate } from "astro:transitions/client"
  import DataTable from "../components/DataTable.svelte"
  import EnablePluginModal from "./EnablePluginModal.svelte"
  import { apiGet, apiFetch } from "../lib/api"
  import { confirmDialog } from "../lib/confirm-dialog"
  import { notify, toastError } from "../lib/toast"
  import type { ResourceDefinition, RowAction } from "../lib/types"

  export let definition: ResourceDefinition

  let enablePluginModalOpen = $state(false)
  let enablePluginModalSlug = $state("")

  type Row = Record<string, any>

  const tableIdPrefix = "resource"

  let items: Row[] = []
  let total = 0
  let query = {
    page: 1,
    pageSize: 20,
    search: "",
    sortKey: null as string | null,
    sortDir: "asc" as "asc" | "desc",
  }
  let loading = false
  let requestId = 0
  
  let dataKey: string | undefined
  let rowIdKey: string | undefined
  $: dataKey = definition?.dataKey
  $: rowIdKey = definition?.singleDataKey

  $: listConfig = definition.list ?? {}
  $: columns = listConfig.columns ?? []
  $: rowActions = listConfig.customRowActions ?? []

  const getLabelPlural = (resource: ResourceDefinition) => {
    if ("labels" in resource && resource.labels) return resource.labels.labelPlural
    return resource.labelPlural ?? resource.label ?? resource.name
  }

  $: title = getLabelPlural(definition)
  $: emptyMessage = `No ${title} found.`

  const unwrapItems = (response: any, dataKey?: string) => {
    const key = dataKey ?? ""
    const candidate =
      (key && response?.data?.[key]) ??
      (key && response?.[key]) ??
      response?.data ??
      response ??
      []
    const items = Array.isArray(candidate) ? candidate : []
    const total = response?.meta?.total ?? response?.total ?? items.length
    return { items, total }
  }

  const buildUrl = (nextQuery = query): string => {
    const params = new URLSearchParams()
    params.set("page", String(nextQuery.page))
    params.set("pageSize", String(nextQuery.pageSize))
    if (nextQuery.search.trim()) params.set("search", nextQuery.search.trim())
    if (nextQuery.sortKey) params.set("sort", `${nextQuery.sortKey}:${nextQuery.sortDir}`)
    const queryString = params.toString()
    const baseUrl = definition.endpoints.list ?? ""
    return queryString ? `${baseUrl}?${queryString}` : baseUrl
  }

  const fetchList = async (nextQuery = query) => {
    const currentRequest = ++requestId
    loading = true
    try {
      const queryUrl = buildUrl(nextQuery)
      const response = await apiGet<any>(queryUrl)
      if (currentRequest !== requestId) return
      const { items: nextItems, total: nextTotal } = unwrapItems(response, dataKey)
      const resolvedItems = Array.isArray(nextItems) ? nextItems : []
      items = [...resolvedItems]
      total = typeof nextTotal === "number" ? nextTotal : resolvedItems.length
    } catch (error) {
      if (currentRequest !== requestId) return
      items = []
      total = 0
    } finally {
      if (currentRequest === requestId) loading = false
    }
  }

  onMount(() => {
    query = {
      page: 1,
      pageSize: listConfig.pageSize ?? 20,
      search: "",
      sortKey: listConfig.defaultSort?.key ?? null,
      sortDir: listConfig.defaultSort?.direction ?? "asc",
    }

    fetchList(query)
  })
</script>
<DataTable
  id={definition.name}
  tableIdPrefix={tableIdPrefix}
  title={title}
  columns={[...columns]}
  rows={[...items]}
  emptyMessage={emptyMessage}
  dataKey={dataKey}
  rowIdKey={rowIdKey}
  loading={loading}
  showSearch={listConfig.searchable ?? false}
  searchPlaceholder={listConfig.searchPlaceholder ?? "Search..."}
  showSelection={false}
  showActions={rowActions.length > 0}
  rowActions={rowActions}
  enableEdit={false}
  disableControlsWhileLoading={true}
  onRowAction={async (action: RowAction, row: Row) => {
    const interpolate = (template: string, row: Record<string, any>): string => {
      return template.replace(/\{(\w+)\}/g, (_, key) => {
        const value = row[key]
        return value !== undefined ? encodeURIComponent(String(value)) : `{${key}}`
      })
    }

    if (action.type === "link" && action.href) {
      navigate(interpolate(action.href, row))
      return
    }

    if (action.type === "conditionalLink" && action.href) {
      const checkKey = action.checkKey ?? "lastPreview"
      if (!row[checkKey]) {
        notify(action.toastIfMissing ?? "Not available.", "info")
        return
      }
      navigate(interpolate(action.href, row))
      return
    }

    if (action.type === "method" && action.endpoint) {
      if (definition.name === "plugins" && action.id === "enable") {
        enablePluginModalSlug = row.slug ?? ""
        enablePluginModalOpen = true
        return
      }

      const confirmed = action.confirm
        ? await confirmDialog({
            title: action.confirm.title,
            body: action.confirm.body,
            confirmLabel: "Yes",
            cancelLabel: "No",
            variant: action.method === "DELETE" ? "destructive" : "default",
          })
        : true
      if (!confirmed) return

      try {
        const endpoint = interpolate(action.endpoint, row)
        const body =
          action.payload === undefined
            ? undefined
            : typeof action.payload === "function"
              ? action.payload(row)
              : action.payload
        await apiFetch(endpoint, {
          method: action.method ?? "POST",
          body: body ? JSON.stringify(body) : undefined,
        })
        if (action.toast?.success) {
          notify(action.toast.success, "success")
        }
        if (action.after === "navigate" && action.href) {
          navigate(interpolate(action.href, row))
          return
        }
        if (action.after === "refresh") {
          window.location.reload()
          return
        }
        // Refresh the list
        await fetchList(query)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Action failed"
        toastError(action.toast?.error ?? action.label, message)
      }
    }
  }}
/>
{#if definition.name === "plugins"}
  <EnablePluginModal
    bind:open={enablePluginModalOpen}
    slug={enablePluginModalSlug}
    onSuccess={() => window.location.reload()}
    onClose={() => { enablePluginModalOpen = false }}
    onError={(msg) => toastError("Enable failed", msg)}
  />
{/if}
