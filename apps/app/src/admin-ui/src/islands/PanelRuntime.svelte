<script lang="ts">
  import type { ActionDescriptor, MethodAction, PanelModule, PanelCtx, QueryState } from "../lib/types"
  import type { ResourcePanelConfig } from "../lib/resource-panel"
  import { onMount } from "svelte"
  import { buildPanelCtx, parseStateFromUrl, updateUrlWithState } from "../lib/state"
  import { apiFetch } from "../lib/api"
  import { notify, toastError } from "../lib/toast"
  import { uiState } from "../lib/state"
  import LayoutRenderer from "./LayoutRenderer.svelte"

  export let panelModuleKey: string
  export let initialData: Record<string, any> | null = null
  export let initialNodes: any[] = []
  export let initialCommands: ActionDescriptor[] = []
  export let href: string
  export let resourceConfig: ResourcePanelConfig | null = null

  let panel: PanelModule | null = null
  let data: Record<string, any> | null = initialData
  let nodes = initialNodes
  let commands: ActionDescriptor[] = initialCommands
  let error: string | null = null
  let loading = false
  let currentState: QueryState = parseStateFromUrl(
    new URL(typeof window === "undefined" ? href : window.location.href)
  )
  const panelModules = import.meta.glob(["/src/pages/**/*.panel.ts", "/src/lib/resource.panel.ts"])

  const buildClientCtx = (): PanelCtx => {
    const url = new URL(window.location.href)
    const ctx = buildPanelCtx(url, {})
    if (resourceConfig?.mode === "list") {
      const listConfig = resourceConfig.resource.list
      let nextState = { ...ctx.state }
      let changed = false
      if (ctx.query.pageSize === undefined && listConfig?.pageSize) {
        nextState = { ...nextState, pageSize: listConfig.pageSize }
        changed = true
      }
      if (ctx.query.sort === undefined && listConfig?.defaultSort) {
        nextState = {
          ...nextState,
          sort: { key: listConfig.defaultSort.key, dir: listConfig.defaultSort.direction },
        }
        changed = true
      }
      if (changed) {
        const nextUrl = updateUrlWithState(url, nextState)
        window.history.replaceState({}, "", nextUrl.toString())
        return buildPanelCtx(nextUrl, {})
      }
    }
    return ctx
  }

  const runQuery = async () => {
    if (!panel) return
    loading = true
    error = null
    try {
      const ctx = buildClientCtx()
      currentState = ctx.state
      const result = await panel.query(ctx)
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        throw new Error("Panel query must return a keyed data bag")
      }
      data = result
      nodes = panel.layout(result, ctx)
      commands = panel.commandBar(ctx, result)
      syncTableUi(nodes, currentState)
    } catch (err) {
      error = err instanceof Error ? err.message : "Query failed"
      toastError("Panel query failed", error)
    } finally {
      loading = false
    }
  }

  const executeMethodAction = async (action: MethodAction, payloadOverride?: Record<string, any>) => {
    if (action.confirm) {
      const confirmed = window.confirm(`${action.confirm.title}\n${action.confirm.body ?? ""}`)
      if (!confirmed) return
    }

    loading = true
    error = null
    try {
      const ctx = buildClientCtx()
      const payload = payloadOverride ?? action.payload?.(ctx, data ?? {})
      await apiFetch(action.endpoint, {
        method: action.method ?? "POST",
        body: payload ? JSON.stringify(payload) : undefined,
      })

      if (action.toast?.success) {
        notify(action.toast.success, "success")
      }

      if (action.after === "navigate" && action.endpoint) {
        window.location.href = action.endpoint
        return
      }

      await runQuery()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed"
      toastError(action.toast?.error ?? action.label, message)
    } finally {
      loading = false
    }
  }

  const handleCommand = async (command: ActionDescriptor) => {
    if (command.type === "link") {
      window.location.href = command.href
      return
    }
    await executeMethodAction(command)
  }

  const handleStateChange = (next: QueryState) => {
    currentState = next
    const url = updateUrlWithState(new URL(window.location.href), next)
    window.history.replaceState({}, "", url.toString())
    syncTableUi(nodes, next)
    runQuery()
  }

  const init = async () => {
    try {
      if (resourceConfig) {
        ;(window as unknown as { __RESOURCE_PANEL_CONFIG__?: ResourcePanelConfig }).__RESOURCE_PANEL_CONFIG__ =
          resourceConfig
      }
      const loader = panelModules[panelModuleKey]
      if (!loader) {
        throw new Error(`Unknown panel module: ${panelModuleKey}`)
      }
      const mod = (await loader()) as { default?: PanelModule }
      panel = mod.default ?? null
      if (!panel) {
        throw new Error(`Panel module missing default export: ${panelModuleKey}`)
      }

      const ctx = buildClientCtx()
      currentState = ctx.state
      if (!data) {
        data = await panel.query(ctx)
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Panel query must return a keyed data bag")
      }
      nodes = panel.layout(data, ctx)
      commands = panel.commandBar(ctx, data)
      syncTableUi(nodes, currentState)
    } catch (err) {
      error = err instanceof Error ? err.message : "Panel load failed"
    }
  }

  const syncTableUi = (layoutNodes: any[], state: QueryState) => {
    const visit = (nodesToVisit: any[]) => {
      nodesToVisit.forEach((node) => {
        if (!node) return
        if (node.type === "table") {
          const tableId = `${panelModuleKey}:${node.props.key}`
          uiState.ensureTable(tableId)
          uiState.setTableState(tableId, {
            search: state.search ?? "",
            sortKey: state.sort?.key ?? null,
            sortDir: state.sort?.dir ?? "asc",
            pageSize: state.pageSize,
            page: state.page,
          })
        }
        if (node.type === "rows" || node.type === "fieldset" || node.type === "card") {
          visit(node.props.nodes ?? [])
        }
        if (node.type === "columns") {
          node.props.columns?.forEach((column: any) => visit(column.nodes ?? []))
        }
      })
    }
    visit(layoutNodes)
  }

  onMount(() => {
    init()
  })
</script>

<div class="space-y-6">
  {#if error}
    <div class="rounded-xl border border-destructive bg-destructive/10 p-4 text-destructive">
      {error}
    </div>
  {:else}
    {#if loading}
      <div class="text-sm text-muted-foreground">Loading...</div>
    {/if}
    <LayoutRenderer
      {nodes}
      data={data ?? {}}
      state={currentState}
      tableIdPrefix={panelModuleKey}
      onStateChange={handleStateChange}
      {commands}
      onCommand={handleCommand}
    />
  {/if}
</div>
