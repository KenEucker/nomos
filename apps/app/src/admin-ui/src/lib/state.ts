// src/lib/uiState.ts
import { writable } from "svelte/store"
import type { PanelCtx, QueryState } from "./types"

export type SortDir = "asc" | "desc"

export type TableUiState = {
  search: string
  sortKey: string | null
  sortDir: SortDir
  page: number
  pageSize: number
}

export type PanelUiState = {
  tables: Record<string, TableUiState>
}

const parseQueryParams = (url: URL): Record<string, string | string[]> => {
  const result: Record<string, string | string[]> = {}
  url.searchParams.forEach((value, key) => {
    if (result[key]) {
      const current = result[key]
      result[key] = Array.isArray(current) ? [...current, value] : [current, value]
      return
    }
    result[key] = value
  })
  return result
}

export const parseStateFromUrl = (url: URL): QueryState => {
  const page = Number(url.searchParams.get("page") ?? "1")
  const pageSize = Number(url.searchParams.get("pageSize") ?? "10")
  const search = url.searchParams.get("search") ?? undefined
  const sortParam = url.searchParams.get("sort")
  const sort = sortParam
    ? {
        key: sortParam.split(":")[0],
        dir: (sortParam.split(":")[1] ?? "asc") as "asc" | "desc",
      }
    : undefined
  const filters: Record<string, string | number | boolean | string[]> = {}
  url.searchParams.forEach((value, key) => {
    if (key.startsWith("filter.")) {
      const fk = key.slice(7)
      const existing = filters[fk]
      if (existing !== undefined) {
        filters[fk] = Array.isArray(existing) ? [...existing, value] : [existing, value]
      } else {
        filters[fk] = value
      }
    }
  })

  return {
    page: Number.isNaN(page) ? 1 : page,
    pageSize: Number.isNaN(pageSize) ? 10 : pageSize,
    search,
    sort,
    filters: Object.keys(filters).length ? filters : undefined,
  }
}

export const buildPanelCtx = (url: URL, params: Record<string, string>, request?: Request): PanelCtx => {
  return {
    url: url.toString(),
    params,
    query: parseQueryParams(url),
    state: parseStateFromUrl(url),
    request,
  }
}

export const updateUrlWithState = (url: URL, state: QueryState): URL => {
  const next = new URL(url.toString())
  next.searchParams.set("page", String(state.page))
  next.searchParams.set("pageSize", String(state.pageSize))
  if (state.search) {
    next.searchParams.set("search", state.search)
  } else {
    next.searchParams.delete("search")
  }
  if (state.sort?.key) {
    next.searchParams.set("sort", `${state.sort.key}:${state.sort.dir}`)
  } else {
    next.searchParams.delete("sort")
  }
  const filterKeys = [...next.searchParams.keys()].filter((k) => k.startsWith("filter."))
  filterKeys.forEach((k) => next.searchParams.delete(k))
  if (state.filters && typeof state.filters === "object") {
    for (const [k, v] of Object.entries(state.filters)) {
      if (v !== undefined && v !== null && v !== "") {
        if (Array.isArray(v)) {
          v.forEach((item) => next.searchParams.append(`filter.${k}`, String(item)))
        } else {
          next.searchParams.set(`filter.${k}`, String(v))
        }
      }
    }
  }
  return next
}

const defaultTableState = (): TableUiState => ({
  search: "",
  sortKey: null,
  sortDir: "asc",
  page: 1,
  pageSize: 10,
})

const createUiState = () => {
  const { subscribe, update } = writable<PanelUiState>({ tables: {} })

  const updateTableState = (
    s: PanelUiState,
    tableId: string,
    updater: (current: TableUiState) => TableUiState
  ): PanelUiState => {
    const current = s.tables[tableId] ?? defaultTableState()
    const next = updater(current)
    return { ...s, tables: { ...s.tables, [tableId]: next } }
  }

  const ensureTable = (tableId: string) =>
    update((s) => {
      if (s.tables[tableId]) return s
      return { ...s, tables: { ...s.tables, [tableId]: defaultTableState() } }
    })

  const setTableSearch = (tableId: string, search: string) =>
    update((s) =>
      updateTableState(s, tableId, (current) => ({
        ...current,
        search,
        page: 1,
      }))
    )

  const setTableState = (tableId: string, next: Partial<TableUiState>) =>
    update((s) =>
      updateTableState(s, tableId, (current) => ({
        ...current,
        ...next,
      }))
    )

  const toggleTableSort = (tableId: string, key: string) =>
    update((s) =>
      updateTableState(s, tableId, (current) => {
        if (current.sortKey === key) {
          return { ...current, sortDir: current.sortDir === "asc" ? "desc" : "asc" }
        }
        return { ...current, sortKey: key, sortDir: "asc" }
      })
    )

  const setTablePage = (tableId: string, page: number) =>
    update((s) =>
      updateTableState(s, tableId, (current) => ({
        ...current,
        page,
      }))
    )

  const setTablePageSize = (tableId: string, pageSize: number) =>
    update((s) =>
      updateTableState(s, tableId, (current) => ({
        ...current,
        pageSize,
        page: 1,
      }))
    )

  const setTableSort = (tableId: string, sortKey: string | null, sortDir: SortDir) =>
    update((s) =>
      updateTableState(s, tableId, (current) => ({
        ...current,
        sortKey,
        sortDir,
        page: 1,
      }))
    )

  const resetTable = (tableId: string) =>
    update((s) => ({ ...s, tables: { ...s.tables, [tableId]: defaultTableState() } }))

  return {
    subscribe,
    ensureTable,
    setTableSearch,
    setTableState,
    toggleTableSort,
    setTableSort,
    setTablePage,
    setTablePageSize,
    resetTable,
  }
}

export const uiState = createUiState()
