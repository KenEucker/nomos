<script lang="ts">
  import type { ActionDescriptor, LayoutNode, QueryState, RowAction } from "../lib/types"
  import DataTable from "../components/DataTable.svelte"
  import PanelHeader from "../components/PanelHeader.svelte"
  import PanelForm from "./PanelForm.svelte"
  import * as Dialog from "$ui/dialog"
  import { Button } from "$ui/button"
  import { can, isAuthReady } from "../lib/authz/authorize.client"
  import { apiFetch } from "../lib/api"
  import { notify, toastError } from "../lib/toast"
  import { confirmDialog } from "../lib/confirm-dialog"
  import { onMount } from "svelte"

  let {
    nodes = [],
    data = {},
    queryState,
    tableIdPrefix,
    onStateChange,
    commands = [],
    onCommand,
  }: {
    nodes?: LayoutNode[]
    data?: Record<string, any>
    queryState: QueryState
    tableIdPrefix: string
    onStateChange: (next: QueryState) => void
    commands?: ActionDescriptor[]
    onCommand: (command: ActionDescriptor) => void
  } = $props()

  let authReady = false
  /** After rotate (or other action that returns a one-time token), show it so the user can copy */
  let revealedToken = $state<string | null>(null)
  let revealedTokenCopied = $state(false)
  /** Inline confirm for rotate so the dialog is guaranteed to show (same island as the table) */
  let pendingRotate = $state<{ action: RowAction; row: Record<string, any> } | null>(null)

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
        <svelte:self
          nodes={node.props.nodes}
          {data}
          {queryState}
          {tableIdPrefix}
          {onStateChange}
          {commands}
          {onCommand}
        />
      </div>
    {:else if node.type === "columns"}
      <div class="grid grid-cols-12 gap-4">
        {#each node.props.columns as column (column)}
          <div class={spanClass(column.span)}>
            <svelte:self
              nodes={column.nodes}
              {data}
              {queryState}
              {tableIdPrefix}
              {onStateChange}
              {commands}
              {onCommand}
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
          <svelte:self
            nodes={node.props.nodes}
            {data}
            {queryState}
            {tableIdPrefix}
            {onStateChange}
            {commands}
            {onCommand}
          />
        </div>
      </div>
    {:else if node.type === "table"}
      {@const serverSide = node.props.serverSide ?? false}
      {@const pagination =
        serverSide && node.props.paginationKey ? data[node.props.paginationKey] ?? {} : null}
      <DataTable
        id={node.props.key}
        tableIdPrefix={tableIdPrefix}
        title={node.props.title ?? "Table"}
        description={node.props.description}
        columns={node.props.columns}
        rows={data[node.props.rowsKey] ?? []}
        dataKey={node.props.rowsKey}
        rowIdKey={node.props.rowIdKey ?? "id"}
        showSelection={false}
        showActions={true}
        enableEdit={node.props.enableEdit ?? false}
        loading={false}
        showSearch={node.props.searchable ?? true}
        searchPlaceholder={node.props.searchPlaceholder}
        page={serverSide ? pagination?.page : undefined}
        pageSize={serverSide ? pagination?.pageSize : undefined}
        total={serverSide ? pagination?.total : undefined}
        editIntent={node.props.editIntent}
        onQueryChange={
          serverSide && node.props.paginationKey
            ? async (query) => {
                const next = {
                  page: query.page,
                  pageSize: query.pageSize,
                  search: query.search || undefined,
                  sort: query.sortKey
                    ? { key: query.sortKey, dir: query.sortDir }
                    : undefined,
                }
                onStateChange(next)
              }
            : undefined
        }
        rowActions={node.props.rowActions}
        onRowAction={async (action, row) => {
          const idKey = node.props.rowIdKey ?? "id"
          const id = row?.[idKey]
          if (!id) return
          const basePath = node.props.rowActionBasePath ?? ""
          if (action.type === "link" && action.href) {
            window.location.href = interpolate(action.href, row)
            return
          }
          const isMethodAction = action.type === "method" && action.endpoint
          const isRotateAction = action.id === "rotate" && id
          // Use inline dialog for rotate so confirm + token reveal are in the same island
          if (isRotateAction) {
            pendingRotate = { action, row }
            return
          }
          if (isMethodAction) {
            const endpoint = interpolate(action.endpoint!, row)
            const method = action.method ?? "POST"
            const body =
              action.payload === undefined
                ? undefined
                : typeof action.payload === "function"
                  ? action.payload(row)
                  : action.payload
            const confirmed = action.confirm
              ? await confirmDialog({
                  title: action.confirm.title,
                  body: action.confirm.body,
                  confirmLabel: "Yes",
                  cancelLabel: "No",
                  variant: method === "DELETE" ? "destructive" : "default",
                })
              : true
            if (!confirmed) return
            try {
              const response = await apiFetch<{ token?: string }>(endpoint, {
                method,
                body: body ? JSON.stringify(body) : undefined,
              })
              const token = response?.data?.token
              if (typeof token === "string" && token.length > 0) {
                revealedToken = token
                revealedTokenCopied = false
                if (action.toast?.success) notify(action.toast.success, "success")
                return
              }
              if (action.toast?.success) notify(action.toast.success, "success")
              if (action.after === "navigate" && action.href) {
                window.location.href = interpolate(action.href, row)
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
          if (action.id === "view") {
            window.location.href = `${basePath}/${encodeURIComponent(String(id))}`
            return
          }
          if (action.id === "edit") {
            window.location.href = `${basePath}/${encodeURIComponent(String(id))}/edit`
            return
          }
          if (action.id === "delete" && node.props.rowActionDeleteEndpoint) {
            const confirmed = await confirmDialog({
              title: "Delete this item?",
              body: "This action cannot be undone.",
              confirmLabel: "Delete",
              cancelLabel: "Cancel",
              variant: "destructive",
            })
            if (!confirmed) return
            const endpoint = interpolate(node.props.rowActionDeleteEndpoint, row)
            await apiFetch(endpoint, { method: "DELETE" })
            onStateChange(queryState)
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
        <svelte:self
          nodes={node.props.nodes}
          {data}
          {queryState}
          {tableIdPrefix}
          {onStateChange}
          {commands}
          {onCommand}
        />
      </fieldset>
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

{#if pendingRotate}
  {@const idKey = "id"}
  {@const id = pendingRotate.row?.[idKey]}
  {@const action = pendingRotate.action}
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
            if (!id) {
              pendingRotate = null
              return
            }
            const endpoint = `/api-keys/${encodeURIComponent(String(id))}`
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
