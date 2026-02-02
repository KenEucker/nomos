<script lang="ts">
  import type { ActionDescriptor, LayoutNode, QueryState, RowAction } from "../lib/types"
  import DataTable from "../components/DataTable.svelte"
  import PanelHeader from "../components/PanelHeader.svelte"
  import PanelForm from "./PanelForm.svelte"
  import LayoutRendererRecursive from "./LayoutRenderer.svelte"
  import * as Dialog from "$ui/dialog"
  import { Button } from "$ui/button"
  import { PieChart } from "$ui/chart"
  import { can, isAuthReady } from "../lib/authz/authorize.client"
  import { apiFetch } from "../lib/api"
  import { notify, toastError } from "../lib/toast"
  import { confirmDialog } from "../lib/confirm-dialog"
  import { onMount } from "svelte"
  import { navigate } from "astro:transitions/client"

  let {
    nodes = [],
    data = {},
    queryState,
    tableIdPrefix,
    onStateChange,
    commands = [],
    onCommand,
    openModalId = null,
    onModalStateChange = () => {},
  }: {
    nodes?: LayoutNode[]
    data?: Record<string, any>
    queryState: QueryState
    tableIdPrefix: string
    onStateChange: (next: QueryState) => void
    commands?: ActionDescriptor[]
    onCommand: (command: ActionDescriptor) => void
    openModalId?: string | null
    onModalStateChange?: (modalId: string | null) => void
  } = $props()

  let authReady = false
  /** After rotate (or other action that returns a one-time token), show it so the user can copy */
  let revealedToken = $state<string | null>(null)
  let revealedTokenCopied = $state(false)
  /** Inline confirm for rotate so the dialog is guaranteed to show (same island as the table) */
  let pendingRotate = $state<{ action: RowAction; row: Record<string, any>; recordId: string; endpoint: string } | null>(null)
  /** Inline confirm for method actions (Enable, Disable, etc.) - same island as table, no global ConfirmDialog */
  let pendingMethodConfirm = $state<{ action: RowAction; row: Record<string, any>; endpoint: string; method: string; body?: string } | null>(null)
  /** Inline confirm for delete action - same island as table, avoids cross-island ConfirmDialog timing */
  let pendingDelete = $state<{ action: RowAction; row: Record<string, any>; endpoint: string } | null>(null)
  /** Per-tabs-instance active tab index, keyed by "prefix:index" */
  let activeTabByKey = $state<Record<string, number>>({})

  onMount(() => {
    // Check if auth is ready on mount (use microtask to ensure DOM is settled)
    queueMicrotask(() => {
      authReady = isAuthReady()
    })
  })

  const getValue = (source: Record<string, any>, path?: string) => {
    if (!path) return undefined
    return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), source)
  }

  const interpolate = (template: string, row: Record<string, any>): string => {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      const value = row[key]
      return value !== undefined ? encodeURIComponent(String(value)) : `{${key}}`
    })
  }

  const spanClass = (span?: number) => {
    switch (span) {
      case 1:
        return "col-span-1"
      case 2:
        return "col-span-2"
      case 3:
        return "col-span-3"
      case 4:
        return "col-span-4"
      case 5:
        return "col-span-5"
      case 6:
        return "col-span-6"
      case 7:
        return "col-span-7"
      case 8:
        return "col-span-8"
      case 9:
        return "col-span-9"
      case 10:
        return "col-span-10"
      case 11:
        return "col-span-11"
      default:
        return "col-span-12"
    }
  }

  const isDenied = (node: LayoutNode) =>
    Boolean(node?.props?.requiredIntent) && !can(node.props.requiredIntent as string)

  const isLoading = (node: LayoutNode) =>
    Boolean(node?.props?.requiredIntent) && !authReady
</script>

<div>
<div class="space-y-6">
  {#each nodes as node, index (index)}
    {#if isLoading(node)}
      <!-- Skeleton loader while auth is loading -->
      <div class="rounded-xl border bg-muted/30 p-6 animate-pulse">
        <div class="h-4 bg-muted rounded w-3/4 mb-3"></div>
        <div class="h-4 bg-muted rounded w-1/2"></div>
      </div>
    {:else if isDenied(node)}
      <div class="rounded-xl border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
        Access denied.
      </div>
    {:else if node.type === "rows"}
      <div class="space-y-6">
        <LayoutRendererRecursive
          nodes={node.props.nodes}
          {data}
          {queryState}
          {tableIdPrefix}
          {onStateChange}
          {commands}
          {onCommand}
          {openModalId}
          {onModalStateChange}
        />
      </div>
    {:else if node.type === "columns"}
      <div class="grid grid-cols-12 gap-4">
        {#each node.props.columns as column (column)}
          <div class={spanClass(column.span)}>
            <LayoutRendererRecursive
              nodes={column.nodes}
              {data}
              {queryState}
              {tableIdPrefix}
              {onStateChange}
              {commands}
              {onCommand}
              {openModalId}
              {onModalStateChange}
            />
          </div>
        {/each}
      </div>
    {:else if node.type === "card"}
      <div class="rounded-xl border bg-card p-6 shadow-sm">
        {#if node.props.title}
          <div class="text-lg font-semibold text-foreground">{node.props.title}</div>
        {/if}
        {#if node.props.description}
          <div class="text-sm text-muted-foreground">{node.props.description}</div>
        {/if}
        <div class="mt-4 space-y-4">
          <LayoutRendererRecursive
            nodes={node.props.nodes}
            {data}
            {queryState}
            {tableIdPrefix}
            {onStateChange}
            {commands}
            {onCommand}
            {openModalId}
            {onModalStateChange}
          />
        </div>
      </div>
    {:else if node.type === "tabs"}
      {@const tabsKey = `${tableIdPrefix}-tabs-${index}`}
      {@const defaultTab = node.props.defaultTab ?? 0}
      {@const activeTab = activeTabByKey[tabsKey] ?? defaultTab}
      <div class="rounded-xl border bg-card">
        <div class="flex border-b">
          {#each node.props.tabs as tab, i (i)}
            <button
              type="button"
              class="px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors {activeTab === i
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"}"
              onclick={() => {
                activeTabByKey = { ...activeTabByKey, [tabsKey]: i }
              }}
            >
              {tab.label}
            </button>
          {/each}
        </div>
        <div class="p-4">
          <LayoutRendererRecursive
            nodes={node.props.tabs[activeTab]?.nodes ?? []}
            {data}
            {queryState}
            {tableIdPrefix}
            {onStateChange}
            {commands}
            {onCommand}
            {openModalId}
            {onModalStateChange}
          />
        </div>
      </div>
    {:else if node.type === "modal"}
      {@const modalOpen = openModalId === node.props.id}
      <Dialog.Root
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) onModalStateChange(null)
        }}
      >
        <Dialog.Content class="sm:max-w-lg">
          {#if node.props.title}
            <Dialog.Header>
              <Dialog.Title>{node.props.title}</Dialog.Title>
            </Dialog.Header>
          {/if}
          <div class="space-y-4 py-2">
            <LayoutRendererRecursive
              nodes={node.props.nodes}
              {data}
              {queryState}
              {tableIdPrefix}
              {onStateChange}
              {commands}
              {onCommand}
              {openModalId}
              {onModalStateChange}
            />
          </div>
          <Dialog.Footer>
            <Button variant="outline" onclick={() => onModalStateChange(null)}>
              Close
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    {:else if node.type === "table"}
      {@const serverSide = node.props.serverSide ?? false}
      {@const pagination =
        serverSide && node.props.paginationKey ? data[node.props.paginationKey] ?? {} : null}
      {@const hasBulkActions = (node.props.bulkActions?.length ?? 0) > 0}
      <DataTable
        id={node.props.key}
        tableIdPrefix={tableIdPrefix}
        title={node.props.title ?? "Table"}
        description={node.props.description}
        columns={node.props.columns}
        rows={data[node.props.rowsKey] ?? []}
        dataKey={node.props.rowsKey}
        rowIdKey={node.props.rowIdKey ?? "id"}
        showSelection={hasBulkActions}
        showActions={true}
        enableEdit={node.props.enableEdit ?? false}
        loading={false}
        showSearch={node.props.searchable ?? true}
        searchPlaceholder={node.props.searchPlaceholder}
        sortable={node.props.sortable ?? true}
        defaultSort={node.props.defaultSort}
        filters={node.props.filters}
        columnVisibility={node.props.columnVisibility ?? false}
        bulkActions={node.props.bulkActions}
        page={serverSide ? pagination?.page : undefined}
        pageSize={serverSide ? pagination?.pageSize : undefined}
        total={serverSide ? pagination?.total : undefined}
        editIntent={node.props.editIntent}
        filtersState={queryState.filters}
        onFiltersChange={(f) => onStateChange({ ...queryState, filters: f })}
        onBulkAction={
          node.props.bulkActions?.length
            ? async (action, rowIds, rows) => {
                if (action.type === "method" && action.endpoint) {
                  const confirmed = action.confirm
                    ? await confirmDialog({
                        title: action.confirm.title,
                        body: action.confirm.body,
                        confirmLabel: "Yes",
                        cancelLabel: "No",
                        variant: "destructive",
                      })
                    : true
                  if (!confirmed) return
                  await apiFetch(action.endpoint, {
                    method: action.method ?? "POST",
                    body: JSON.stringify({ ids: rowIds }),
                  })
                  if (action.toast?.success) notify(action.toast.success, "success")
                  if (action.after === "refresh") onStateChange(queryState)
                }
                onCommand(action)
              }
            : undefined
        }
        onQueryChange={
          serverSide && node.props.paginationKey
            ? async (query) => {
                const next = {
                  ...queryState,
                  page: query.page,
                  pageSize: query.pageSize,
                  search: query.search || undefined,
                  sort: query.sortKey
                    ? { key: query.sortKey, dir: query.sortDir }
                    : undefined,
                  filters: "filters" in query ? (query as any).filters : queryState.filters,
                }
                onStateChange(next)
              }
            : undefined
        }
        rowActions={node.props.rowActions}
        onRowAction={async (action, row) => {
          const basePath = node.props.rowActionBasePath ?? ""
          const idKey = node.props.rowIdKey ?? "id"
          const id = row?.[idKey]

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

          // Method actions (Enable, Disable, etc.) use row for endpoint interpolation (e.g. {slug});
          // handle before id check so slug-based resources like plugins work.
          // Exclude rotate - it uses inline dialog and token reveal.
          const isMethodAction = action.type === "method" && action.endpoint && action.id !== "rotate"
          if (isMethodAction) {
            const endpoint = interpolate(action.endpoint!, row)
            const method = action.method ?? "POST"
            const body =
              action.payload === undefined
                ? undefined
                : typeof action.payload === "function"
                  ? action.payload(row)
                  : action.payload
            if (action.confirm) {
              pendingMethodConfirm = { action, row, endpoint, method, body: body !== undefined ? JSON.stringify(body) : undefined }
              return
            }
            try {
              const response = await apiFetch<{ token?: string; isOwnSession?: boolean }>(endpoint, {
                method,
                body: body !== undefined ? JSON.stringify(body) : undefined,
              })
              
              // If the user deleted/revoked their own session, redirect to login
              if (response?.data?.isOwnSession) {
                notify("Session deleted. You have been logged out.", "success")
                window.location.href = "/admin/nomos/login"
                return
              }
              
              if (action.toast?.success) notify(action.toast.success, "success")
              if (action.after === "navigate" && action.href) {
                navigate(interpolate(action.href, row))
                return
              }
              if (action.after === "refresh") {
                window.location.reload()
                return
              }
              onStateChange(queryState)
            } catch (err) {
              const message = err instanceof Error ? err.message : "Action failed"
              toastError(action.toast?.error ?? action.label, message)
            }
            return
          }

          if (!id) return

          const isRotateAction = action.id === "rotate" && id
          // Use inline dialog for rotate so confirm + token reveal are in the same island
          if (isRotateAction) {
            const recordId = row[idKey] ?? row.id
            const endpoint = action.endpoint ? interpolate(action.endpoint, row) : `/api-keys/${recordId}`
            pendingRotate = { action, row, recordId, endpoint }
            return
          }
          if (action.id === "view") {
            navigate(`${basePath}/${encodeURIComponent(String(id))}`)
            return
          }
          if (action.id === "edit") {
            navigate(`${basePath}/${encodeURIComponent(String(id))}/edit`)
            return
          }
          if (action.id === "delete" && node.props.rowActionDeleteEndpoint) {
            const endpoint = interpolate(node.props.rowActionDeleteEndpoint, row)
            pendingDelete = { action, row, endpoint }
            return
          }
        }}
        onSave={
          node.props.saveEndpoint
            ? async ({ row, patch }) => {
                const endpoint = interpolate(node.props.saveEndpoint!, row)
                await apiFetch(endpoint, {
                  method: node.props.saveMethod ?? "PATCH",
                  body: JSON.stringify({ id: row.id, patch }),
                })
                onStateChange(queryState)
              }
            : undefined
        }
      />
    {:else if node.type === "form"}
      <PanelForm
        id={node.props.id}
        title={node.props.title}
        description={node.props.description}
        schema={node.props.schema}
        fields={node.props.fields}
        submitLabel={node.props.submitLabel}
        submitEndpoint={node.props.submitEndpoint}
        submitMethod={node.props.submitMethod}
        initialValuesKey={node.props.initialValuesKey}
        after={node.props.after}
        redirectTo={node.props.redirectTo}
        {data}
        onRefresh={() => onStateChange(queryState)}
      />
    {:else if node.type === "fieldset"}
      <fieldset class="space-y-4 rounded-xl border bg-card p-6">
        {#if node.props.title}
          <legend class="px-2 text-sm font-semibold text-muted-foreground">{node.props.title}</legend>
        {/if}
        <LayoutRendererRecursive
          nodes={node.props.nodes}
          {data}
          {queryState}
          {tableIdPrefix}
          {onStateChange}
          {commands}
          {onCommand}
          {openModalId}
          {onModalStateChange}
        />
      </fieldset>
    {:else if node.type === "lineChart" || node.type === "barChart"}
      {@const chartData = getValue(data, node.props.dataKey) ?? []}
      {@const arr = Array.isArray(chartData) ? chartData : []}
      {@const xKey = node.props.xKey}
      {@const yKey = node.props.yKey}
      {@const maxVal = arr.length ? Math.max(...arr.map((r: Record<string, any>) => Number(r?.[yKey]) || 0)) : 1}
      <div class="rounded-xl border bg-card p-6">
        {#if node.props.title}
          <div class="text-lg font-semibold text-foreground mb-2">{node.props.title}</div>
        {/if}
        {#if node.props.description}
          <div class="text-sm text-muted-foreground mb-4">{node.props.description}</div>
        {/if}
        <div class="h-48 flex items-end gap-1">
          {#each arr as item}
            {@const val = Number(item?.[yKey]) || 0}
            {@const pct = maxVal > 0 ? (val / maxVal) * 100 : 0}
            <div
              class="flex-1 min-w-0 flex flex-col items-center gap-1"
              title="{String(item?.[xKey] ?? "")}: {val}"
            >
              <div
                class="w-full bg-primary/70 rounded-t transition-all"
                style={`height: ${pct}%`}
              ></div>
              <span class="text-xs text-muted-foreground truncate max-w-full" title={String(item?.[xKey] ?? "")}>
                {String(item?.[xKey] ?? "").slice(0, 6)}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {:else if node.type === "pieChart"}
      {@const chartData = getValue(data, node.props.dataKey) ?? []}
      {@const arr = Array.isArray(chartData) ? chartData : []}
      <PieChart
        data={arr}
        categoryKey={node.props.categoryKey}
        valueKey={node.props.valueKey}
        title={node.props.title}
        description={node.props.description}
      />
    {:else if node.type === "text"}
      <p class="text-sm text-foreground">{node.props.value ?? getValue(data, node.props.valueKey)}</p>
    {:else if node.type === "stat"}
      {@const rawValue = getValue(data, node.props.valueKey)}
      {@const isArray = Array.isArray(rawValue)}
      <div class="rounded-lg border bg-background p-4 min-w-0">
        <div class="text-xs uppercase tracking-wide text-muted-foreground">{node.props.label}</div>
        <div class="mt-1 text-2xl font-semibold text-foreground min-w-0 break-words">
          {#if isArray && rawValue.length > 0}
            <ul class="list-none space-y-1 text-base font-normal">
              {#each rawValue as item (item)}
                <li class="break-words">{item}</li>
              {/each}
            </ul>
          {:else if isArray && rawValue.length === 0}
            —
          {:else}
            {rawValue ?? "—"}
          {/if}
        </div>
      </div>
    {:else if node.type === "header"}
      <PanelHeader
        title={node.props.title}
        subtitle={node.props.subtitle}
        {commands}
        {onCommand}
      />
    {:else if node.type === "iframe"}
      <div class="overflow-hidden rounded-xl border bg-card">
        <iframe
          src={node.props.src}
          title={node.props.title}
          class="w-full border-0"
          style={`height: ${node.props.height ?? "600px"}`}
        ></iframe>
      </div>
    {/if}
  {/each}
</div>

{#if pendingMethodConfirm}
  {@const item = pendingMethodConfirm}
  {@const action = item.action}
  <Dialog.Root
    open={true}
    onOpenChange={(open: boolean) => {
      if (!open) pendingMethodConfirm = null
    }}
  >
    <Dialog.Content class="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title>{action.confirm?.title ?? "Confirm"}</Dialog.Title>
        {#if action.confirm?.body}
          <Dialog.Description>{action.confirm.body}</Dialog.Description>
        {/if}
      </Dialog.Header>
      <Dialog.Footer>
        <Button variant="outline" onclick={() => { pendingMethodConfirm = null }}>
          No
        </Button>
        <Button
          onclick={async () => {
            try {
              const response = await apiFetch<{ isOwnSession?: boolean }>(item.endpoint, {
                method: item.method,
                body: item.body,
              })
              
              // If the user deleted/revoked their own session, redirect to login
              if (response?.data?.isOwnSession) {
                pendingMethodConfirm = null
                notify("Session deleted. You have been logged out.", "success")
                window.location.href = "/admin/nomos/login"
                return
              }
              
              if (action.toast?.success) notify(action.toast.success, "success")
              if (action.after === "navigate" && action.href) {
                pendingMethodConfirm = null
                navigate(interpolate(action.href, item.row))
                return
              }
              if (action.after === "refresh" || (action.confirm && action.after !== "navigate")) {
                pendingMethodConfirm = null
                onStateChange(queryState)
                const url = new URL(window.location.href)
                url.searchParams.set("_r", String(Date.now()))
                const a = document.createElement("a")
                a.href = url.toString()
                a.setAttribute("data-astro-reload", "")
                document.body.appendChild(a)
                a.click()
                a.remove()
                return
              }
              pendingMethodConfirm = null
              onStateChange(queryState)
            } catch (err) {
              const message = err instanceof Error ? err.message : "Action failed"
              toastError(action.toast?.error ?? action.label, message)
            }
          }}
        >
          Yes
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}

{#if pendingDelete}
  {@const item = pendingDelete}
  {@const action = item.action}
  <Dialog.Root
    open={true}
    onOpenChange={(open: boolean) => {
      if (!open) pendingDelete = null
    }}
  >
    <Dialog.Content class="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title>Delete this item?</Dialog.Title>
        <Dialog.Description>This action cannot be undone.</Dialog.Description>
      </Dialog.Header>
      <Dialog.Footer>
        <Button variant="outline" onclick={() => { pendingDelete = null }}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onclick={async () => {
            try {
              const response = await apiFetch<{ deleted: boolean; isOwnSession?: boolean }>(item.endpoint, { method: "DELETE" })
              pendingDelete = null
              if (response?.data?.isOwnSession) {
                notify("Session deleted. You have been logged out.", "success")
                window.location.href = "/admin/nomos/login"
                return
              }
              onStateChange(queryState)
            } catch (err) {
              const message = err instanceof Error ? err.message : "Delete failed"
              toastError("Delete failed", message)
            }
          }}
        >
          Delete
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}

{#if pendingRotate}
  {@const action = pendingRotate.action}
  {@const recordId = pendingRotate.recordId}
  {@const endpoint = pendingRotate.endpoint}
  <Dialog.Root
    open={true}
    onOpenChange={(open: boolean) => {
      if (!open) pendingRotate = null
    }}
  >
    <Dialog.Content class="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title>{action.confirm?.title ?? "Rotate API key?"}</Dialog.Title>
        <Dialog.Description>
          {action.confirm?.body ?? "The old key will stop working immediately."}
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.Footer>
        <Button variant="outline" onclick={() => { pendingRotate = null }}>
          No
        </Button>
        <Button
          onclick={async () => {
            if (!recordId) {
              pendingRotate = null
              return
            }
            try {
              const response = await apiFetch<{ token?: string }>(endpoint, {
                method: "PATCH",
                body: JSON.stringify({ action: "rotate" }),
              })
              pendingRotate = null
              const token = response?.data?.token
              if (typeof token === "string" && token.length > 0) {
                revealedToken = token
                revealedTokenCopied = false
                if (action.toast?.success) notify(action.toast.success, "success")
              } else {
                if (action.toast?.success) notify(action.toast.success, "success")
                onStateChange(queryState)
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : "Action failed"
              toastError(action.toast?.error ?? action.label, message)
              pendingRotate = null
            }
          }}
        >
          Yes
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}

{#if revealedToken}
  <Dialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open) {
        revealedToken = null
        onStateChange(queryState)
      }
    }}
  >
    <Dialog.Content class="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title>Your new API key</Dialog.Title>
        <Dialog.Description>
          Copy it now — it won't be shown again.
        </Dialog.Description>
      </Dialog.Header>
      <div class="flex items-center gap-2 py-2">
        <code class="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono break-all select-all">
          {revealedToken}
        </code>
        <Button
          type="button"
          variant="outline"
          onclick={async () => {
            try {
              await navigator.clipboard.writeText(revealedToken ?? "")
              revealedTokenCopied = true
            } catch {
              // ignore
            }
          }}
        >
          {revealedTokenCopied ? "Copied" : "Copy"}
        </Button>
      </div>
      <Dialog.Footer>
        <Button
          type="button"
          onclick={() => {
            revealedToken = null
            onStateChange(queryState)
          }}
        >
          Done
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
</div>
