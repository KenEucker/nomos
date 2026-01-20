<script lang="ts">
  import { onMount } from "svelte"
  import { uiState } from "../lib/state"
  import type { ColumnDef, RowAction } from "../lib/types"
  import { can, notifyDeny } from "../lib/authz/authorize.client"

  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$ui/card"
  import { Input } from "$ui/input"
  import { Button } from "$ui/button"
  import { Badge } from "$ui/badge"
  import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
  } from "$ui/table"
  import { Checkbox } from "$ui/checkbox"
  import * as Dialog from "$ui/dialog"

  type Row = Record<string, any>

  export let id: string | undefined = undefined
  export let tableIdPrefix: string

  export let title: string
  export let description: string | undefined = undefined
  export let columns: ColumnDef[]
  export let rows: Row[]
  export let emptyMessage: string | undefined = undefined
  export let rowActions: RowAction[] | undefined = undefined
  export let showSearch: boolean = true
  export let searchPlaceholder: string = "Search…"
  export let showSelection: boolean = true
  export let showActions: boolean = true
  export let enableEdit: boolean = true
  export let disableControlsWhileLoading: boolean = false
  export let editIntent: string | undefined = undefined

  // metadata for deterministic patching
  export let dataKey: string | undefined = undefined
  export let rowIdKey: string | undefined = undefined

  export let page: number | undefined = undefined
  export let pageSize: number | undefined = undefined
  export let total: number | undefined = undefined
  export let loading: boolean = false
  export let onQueryChange:
    | ((query: {
        page: number
        pageSize: number
        search: string
        sortKey: string | null
        sortDir: "asc" | "desc"
      }) => void | Promise<void>)
    | undefined = undefined

  // ✅ Svelte 5-forward “events”: callback props
  export let onSelect:
    | ((info: { tableId: string; rows: Row[]; rowIds: Array<string | number> }) => void)
    | undefined = undefined

  export let onSave:
    | ((info: {
        tableId: string
        dataKey?: string
        rowIdKey?: string
        row: Row
        patch: Partial<Row>
      }) => void | Promise<void>)
    | undefined = undefined

  export let onRowAction:
    | ((action: RowAction, row: Row) => void | Promise<void>)
    | undefined = undefined

  $: tableId = `${tableIdPrefix}:${id ?? title}`
  $: actionColumnVisible = showActions && (enableEdit || (rowActions?.length ?? 0) > 0)
  $: columnCount = columns.length + (showSelection ? 1 : 0) + (actionColumnVisible ? 1 : 0)

  const isDenied = (intent?: string) => Boolean(intent) && !can(intent)
  const denyIfNeeded = (intent?: string) => {
    if (!intent) return false
    if (can(intent)) return false
    notifyDeny(intent)
    return true
  }

  // ---- Search / Sort helpers ----
  const normalize = (v: unknown) => String(v ?? "").toLowerCase()

  const matchesSearch = (row: Row, search: string) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return Object.values(row).some((v) => normalize(v).includes(q))
  }

  const compare = (a: any, b: any) => {
    const an = typeof a === "number" ? a : Number(a)
    const bn = typeof b === "number" ? b : Number(b)
    const aIsNum = !Number.isNaN(an) && a !== "" && a !== null && a !== undefined
    const bIsNum = !Number.isNaN(bn) && b !== "" && b !== null && b !== undefined
    if (aIsNum && bIsNum) return an - bn
    return String(a ?? "").localeCompare(String(b ?? ""))
  }

  const getNestedValue = (obj: Record<string, any>, path: string) =>
    path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj)

  const formatDate = (value: string) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString()
  }

  const formatDateTime = (value: string) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
  }

  const formatCellValue = (value: unknown, render?: ColumnDef["render"]) => {
    if (value === null || value === undefined) return "—"
    if (render === "datetime") return formatDateTime(String(value))
    if (render === "date") return formatDate(String(value))
    if (render === "boolean") return value ? "Yes" : "No"
    if (render === "json") return JSON.stringify(value)
    if (Array.isArray(value)) return value.join(", ")
    return String(value)
  }

  const resolveBadgeVariant = (column: ColumnDef, value: unknown) => {
    if (!column.badgeVariants) return "secondary"
    const key = String(value)
    return column.badgeVariants[key] ?? "secondary"
  }

  const actionVisible = (action: RowAction, row: Row) => {
    if (!action.showWhen) return true
    const value = getNestedValue(row, action.showWhen.key)
    if (action.showWhen.equals !== undefined) return value === action.showWhen.equals
    if (action.showWhen.notEquals !== undefined) return value !== action.showWhen.notEquals
    if (action.showWhen.truthy) return Boolean(value)
    return true
  }

  const deriveRows = (
    source: Row[],
    state: { search: string; sortKey: string | null; sortDir: "asc" | "desc" }
  ) => {
    const filtered = source.filter((r) => matchesSearch(r, state.search))
    if (!state.sortKey) return filtered

    return [...filtered].sort((ra, rb) => {
      const res = compare(ra[state.sortKey!], rb[state.sortKey!])
      return state.sortDir === "asc" ? res : -res
    })
  }

  onMount(() => {
    uiState.ensureTable(tableId)
  })

  $: tableState =
    $uiState.tables?.[tableId] ?? { search: "", sortKey: null, sortDir: "asc", page: 1, pageSize: 10 }
  $: effectivePage = page ?? tableState.page
  $: effectivePageSize = pageSize ?? tableState.pageSize
  $: displayRows = onQueryChange
    ? ((rows ?? []) as Row[])
    : deriveRows((rows ?? []) as Row[], tableState)
  $: totalPages = Math.max(1, Math.ceil((total ?? displayRows.length) / effectivePageSize))
  $: pageStart = (effectivePage - 1) * effectivePageSize
  $: paginatedRows = onQueryChange
    ? displayRows
    : displayRows.slice(pageStart, pageStart + effectivePageSize)

  $: if (page != null && page !== tableState.page) {
    uiState.setTablePage(tableId, page)
  }

  $: if (pageSize != null && pageSize !== tableState.pageSize) {
    uiState.setTablePageSize(tableId, pageSize)
  }

  // ---- Selection + Dialog ----
  const getRowId = (row: Row, idx: number) =>
    rowIdKey && row?.[rowIdKey] != null ? (row[rowIdKey] as string | number) : idx

  let selectedIds = new Set<string | number>()
  $: selectionOffset = onQueryChange ? pageStart : 0
  $: selectedRows = displayRows.reduce<Row[]>((acc, row, idx) => {
    if (selectedIds.has(getRowId(row, selectionOffset + idx))) acc.push(row)
    return acc
  }, [])
  $: selectedRowIds = displayRows.reduce<Array<string | number>>((acc, row, idx) => {
    const id = getRowId(row, selectionOffset + idx)
    if (selectedIds.has(id)) acc.push(id)
    return acc
  }, [])
  $: onSelect?.({
    tableId,
    rows: selectedRows,
    rowIds: selectedRowIds,
  })

  let dialogOpen = false
  let editIndex: number | null = null
  let editDraft: Row | null = null

  const toggleSelected = (idx: number) => {
    const row = paginatedRows[idx]
    if (!row) return
    const id = getRowId(row, pageStart + idx)
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    selectedIds = next
  }

  const triggerQueryChange = async (overrides?: Partial<{
    page: number
    pageSize: number
    search: string
    sortKey: string | null
    sortDir: "asc" | "desc"
  }>) => {
    await onQueryChange?.({
      page: overrides?.page ?? effectivePage,
      pageSize: overrides?.pageSize ?? effectivePageSize,
      search: overrides?.search ?? tableState.search,
      sortKey: overrides?.sortKey ?? tableState.sortKey,
      sortDir: overrides?.sortDir ?? tableState.sortDir,
    })
  }

  const setPage = async (next: number) => {
    const clamped = Math.min(totalPages, Math.max(1, next))
    uiState.setTablePage(tableId, clamped)
    await triggerQueryChange({ page: clamped })
  }

  const setPageSize = async (next: number) => {
    uiState.setTablePageSize(tableId, next)
    await triggerQueryChange({ page: 1, pageSize: next })
  }

  const openEdit = (row: Row, idx: number) => {
    if (denyIfNeeded(editIntent)) return
    editIndex = pageStart + idx
    editDraft = { ...row }
    dialogOpen = true
  }

  const saveEdit = async () => {
    if (editIndex == null || !editDraft) return
    const original = displayRows[editIndex]
    if (!original) return

    const patch: Partial<Row> = {}
    for (const col of columns) {
      if (editDraft[col.key] !== original[col.key]) patch[col.key] = editDraft[col.key]
    }

    if (Object.keys(patch).length === 0) {
      dialogOpen = false
      return
    }

    await onSave?.({ tableId, dataKey, rowIdKey, row: original, patch })
    dialogOpen = false
  }
</script>

<Card>
  <CardHeader>
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <CardTitle>{title}</CardTitle>
        {#if description}
          <CardDescription>{description}</CardDescription>
        {/if}
      </div>

      {#if showSearch}
        <div class="w-64">
          <Input
            value={tableState.search}
            placeholder={searchPlaceholder}
            disabled={disableControlsWhileLoading && loading}
            oninput={async (e) => {
              const nextSearch = (e.currentTarget as HTMLInputElement).value
              uiState.setTableSearch(tableId, nextSearch)
              await triggerQueryChange({ page: 1, search: nextSearch })
            }}
          />
        </div>
      {/if}
    </div>
  </CardHeader>

  <CardContent class="pt-0">
    <div class="rounded-md border overflow-auto relative">
      <Table>
        <TableHeader>
          <TableRow>
            {#if showSelection}
              <TableHead class="w-10"></TableHead>
            {/if}

            {#each columns as col (col.key)}
              <TableHead class={col.hideOnMobile ? "hidden sm:table-cell" : ""}>
                {#if col.sortable}
                  <Button
                    variant="ghost"
                    class="h-8 px-2 -ml-2"
                    disabled={disableControlsWhileLoading && loading}
                    onclick={async () => {
                      const nextSortDir =
                        tableState.sortKey === col.key
                          ? tableState.sortDir === "asc"
                            ? "desc"
                            : "asc"
                          : "asc"
                      uiState.toggleTableSort(tableId, col.key)
                      uiState.setTablePage(tableId, 1)
                      await triggerQueryChange({ page: 1, sortKey: col.key, sortDir: nextSortDir })
                    }}
                  >
                    {col.label}
                    {#if tableState.sortKey === col.key}
                      <span class="ml-2 text-xs text-muted-foreground">
                        {tableState.sortDir === "asc" ? "▲" : "▼"}
                      </span>
                    {/if}
                  </Button>
                {:else}
                  <span class="text-sm font-medium">{col.label}</span>
                {/if}
              </TableHead>
            {/each}

            {#if actionColumnVisible}
              <TableHead class="w-32 text-right">Actions</TableHead>
            {/if}
          </TableRow>
        </TableHeader>

        <TableBody>
          {#if displayRows.length === 0}
            <TableRow>
              <TableCell colspan={columnCount} class="text-muted-foreground">
                {emptyMessage ?? "No data."}
              </TableCell>
            </TableRow>
          {:else}
          {#each paginatedRows as row, rIdx (pageStart + rIdx)}
              <TableRow class={selectedIds.has(getRowId(row, pageStart + rIdx)) ? "bg-muted/40" : ""}>
                {#if showSelection}
                  <TableCell>
                    <!-- avoid Checkbox custom events: use button for a11y -->
                    <button
                      type="button"
                      class="inline-flex items-center"
                      onclick={() => toggleSelected(rIdx)}
                      aria-pressed={selectedIds.has(getRowId(row, pageStart + rIdx))}
                      disabled={disableControlsWhileLoading && loading}
                    >
                      <Checkbox
                        checked={selectedIds.has(getRowId(row, pageStart + rIdx))}
                        aria-label="Select row"
                      />
                    </button>
                  </TableCell>
                {/if}

                {#each columns as col (col.key)}
                  {@const value = getNestedValue(row, col.key)}
                  <TableCell
                    class={col.hideOnMobile ? "hidden sm:table-cell" : ""}
                    style={col.width ? `width: ${col.width}` : undefined}
                  >
                    {#if col.render === "badge"}
                      <Badge variant={resolveBadgeVariant(col, value)}>{formatCellValue(value)}</Badge>
                    {:else if col.render === "email"}
                      {#if value == null}
                        {formatCellValue(value)}
                      {:else}
                        <a
                          class="text-primary underline-offset-2 hover:underline"
                          href={`mailto:${String(value)}`}
                        >
                          {formatCellValue(value)}
                        </a>
                      {/if}
                    {:else if col.render === "link"}
                      {#if value == null}
                        {formatCellValue(value)}
                      {:else}
                        {@const href = col.linkTemplate
                          ? col.linkTemplate.replace("{value}", encodeURIComponent(String(value)))
                          : String(value)}
                        <a class="text-primary underline-offset-2 hover:underline" href={href}>
                          {formatCellValue(value)}
                        </a>
                      {/if}
                    {:else if col.render === "json"}
                      <code class="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                        {formatCellValue(value, "json")}
                      </code>
                    {:else}
                      {formatCellValue(value, col.render)}
                    {/if}
                  </TableCell>
                {/each}

                {#if actionColumnVisible}
                  <TableCell class="text-right">
                    <div class="flex justify-end gap-2">
                      {#if rowActions?.length}
                        {#each rowActions as action (action.id)}
                          {#if actionVisible(action, row)}
                            {@const actionDenied = isDenied(action.intent)}
                            <Button
                              size="sm"
                              variant={action.variant ?? "secondary"}
                              onclick={() => {
                                if (denyIfNeeded(action.intent)) return
                                onRowAction?.(action, row)
                              }}
                              aria-disabled={actionDenied}
                              class={actionDenied ? "opacity-60 cursor-not-allowed" : ""}
                              disabled={disableControlsWhileLoading && loading}
                            >
                              {action.label}
                            </Button>
                          {/if}
                        {/each}
                      {/if}
                      {#if enableEdit}
                        {@const editDenied = isDenied(editIntent)}
                        <Button
                          size="sm"
                          variant="secondary"
                          onclick={() => openEdit(row, rIdx)}
                          aria-disabled={editDenied}
                          class={editDenied ? "opacity-60 cursor-not-allowed" : ""}
                          disabled={disableControlsWhileLoading && loading}
                        >
                          Edit
                        </Button>
                      {/if}
                    </div>
                  </TableCell>
                {/if}
              </TableRow>
            {/each}
          {/if}
        </TableBody>
      </Table>

      {#if loading}
        <div class="absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
          Loading…
        </div>
      {/if}

      <div class="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/5 px-4 py-3 text-sm">
        <div class="text-muted-foreground">
          Page {effectivePage} of {totalPages}
          {#if total != null}
            · {total} total
          {/if}
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onclick={() => setPage(effectivePage - 1)}
            disabled={(disableControlsWhileLoading && loading) || effectivePage <= 1}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onclick={() => setPage(effectivePage + 1)}
            disabled={(disableControlsWhileLoading && loading) || effectivePage >= totalPages}
          >
            Next
          </Button>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">Jump</span>
            <Input
              class="w-16"
              value={String(effectivePage)}
              onblur={(e) => setPage(Number((e.currentTarget as HTMLInputElement).value))}
              disabled={disableControlsWhileLoading && loading}
            />
          </div>
          <select
            class="rounded-md border border-input bg-background px-2 py-1 text-xs"
            oninput={(e) => setPageSize(Number((e.currentTarget as HTMLSelectElement).value))}
            value={String(effectivePageSize)}
            disabled={disableControlsWhileLoading && loading}
          >
            <option value="5">5 / page</option>
            <option value="10">10 / page</option>
            <option value="20">20 / page</option>
          </select>
        </div>
      </div>

      {#if enableEdit}
        <Dialog.Root bind:open={dialogOpen}>
          <Dialog.Content class="sm:max-w-lg">
            <Dialog.Header>
              <Dialog.Title>Edit</Dialog.Title>
              <Dialog.Description>Update fields and save.</Dialog.Description>
            </Dialog.Header>

            {#if editDraft}
              <div class="space-y-4 py-2">
                {#each columns as col (col.key)}
                  <div class="space-y-1">
                    <div class="text-sm font-medium">{col.label}</div>
                    <Input
                      value={String(editDraft[col.key] ?? "")}
                      oninput={(e) => {
                        const v = (e.currentTarget as HTMLInputElement).value
                        editDraft = { ...editDraft, [col.key]: v }
                      }}
                    />
                  </div>
                {/each}
              </div>
            {/if}

            <Dialog.Footer class="gap-2">
              <Button variant="ghost" onclick={() => (dialogOpen = false)}>Cancel</Button>
              <Button onclick={saveEdit}>Save</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      {/if}
    </div>
  </CardContent>
</Card>
