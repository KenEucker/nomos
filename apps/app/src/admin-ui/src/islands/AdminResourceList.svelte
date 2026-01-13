<script lang="ts">
  import { onMount } from "svelte";
  import Table from "../components/ui/table.svelte";
  import Button from "../components/ui/button.svelte";
  import Badge from "../components/ui/badge.svelte";
  import Input from "../components/ui/input.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import { apiGet, apiDelete } from "../lib/api";
  import type { AdminResource, ColumnDef } from "../lib/resources/types";
  import { resolveEndpoint } from "../lib/resources/types";

  interface Props {
    resource: AdminResource;
    onNavigate?: (path: string) => void;
  }

  let { resource, onNavigate }: Props = $props();

  let items = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let search = $state("");
  let page = $state(1);
  let pageSize = $state(resource.list.pageSize ?? 20);
  let total = $state(0);
  let sortKey = $state(resource.list.defaultSort?.key ?? "");
  let sortDir = $state<"asc" | "desc">(resource.list.defaultSort?.dir ?? "desc");

  // Delete confirmation
  let deleteId = $state<string | null>(null);
  let deleteDialogOpen = $state(false);
  let deleting = $state(false);

  const loadData = async () => {
    loading = true;
    error = null;
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      });
      if (search) {
        params.set("search", search);
      }
      if (sortKey) {
        params.set("sort", `${sortKey}:${sortDir}`);
      }
      const response = await apiGet<any>(`${resource.endpoints.list}?${params}`);
      const dataKey = resource.dataKey ?? resource.id;
      items = response.data?.[dataKey] ?? response.data ?? [];
      total = response.meta?.total ?? items.length;
    } catch (err: any) {
      error = err.message ?? "Failed to load data";
      items = [];
    } finally {
      loading = false;
    }
  };

  const handleSearch = () => {
    page = 1;
    loadData();
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDir = "asc";
    }
    loadData();
  };

  const handlePrevPage = () => {
    if (page > 1) {
      page--;
      loadData();
    }
  };

  const handleNextPage = () => {
    if (page * pageSize < total) {
      page++;
      loadData();
    }
  };

  const navigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  };

  const handleView = (id: string) => {
    navigate(`${resource.routeBase}/${id}`);
  };

  const handleEdit = (id: string) => {
    navigate(`${resource.routeBase}/${id}/edit`);
  };

  const handleCreate = () => {
    navigate(`${resource.routeBase}/new`);
  };

  const confirmDelete = (id: string) => {
    deleteId = id;
    deleteDialogOpen = true;
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    deleting = true;
    try {
      const endpoint = resolveEndpoint(resource.endpoints.delete, deleteId);
      await apiDelete(endpoint);
      deleteDialogOpen = false;
      deleteId = null;
      loadData();
    } catch (err: any) {
      error = err.message ?? "Failed to delete";
    } finally {
      deleting = false;
    }
  };

  const formatCellValue = (item: any, column: ColumnDef): string => {
    const value = getNestedValue(item, column.key);

    if (value === null || value === undefined) {
      return "-";
    }

    switch (column.render) {
      case "datetime":
        return formatDateTime(value);
      case "date":
        return formatDate(value);
      case "boolean":
        return value ? "Yes" : "No";
      case "json":
        return JSON.stringify(value);
      default:
        if (Array.isArray(value)) {
          return value.join(", ");
        }
        return String(value);
    }
  };

  const getNestedValue = (obj: any, path: string): any => {
    return path.split(".").reduce((acc, part) => acc?.[part], obj);
  };

  const formatDateTime = (value: string): string => {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  const formatDate = (value: string): string => {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  };

  const getBadgeVariant = (value: any, column: ColumnDef): "default" | "secondary" | "success" | "destructive" | "warning" => {
    if (column.badgeVariants) {
      const key = String(value);
      const variant = column.badgeVariants[key];
      if (variant === "success" || variant === "destructive" || variant === "warning" || variant === "secondary") {
        return variant;
      }
    }
    if (value === true || value === "active" || value === "success") return "success";
    if (value === false || value === "inactive" || value === "failed" || value === "expired") return "destructive";
    return "default";
  };

  const totalPages = $derived(Math.ceil(total / pageSize));
  const hasActions = $derived(
    resource.actions?.view !== false ||
    resource.actions?.update !== false ||
    resource.actions?.delete !== false
  );

  onMount(() => {
    loadData();
  });
</script>

<div class="space-y-4">
  <!-- Header with search and create button -->
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    {#if resource.list.searchable}
      <div class="flex flex-1 gap-2">
        <Input
          className="flex-1 sm:max-w-sm"
          placeholder={resource.list.searchPlaceholder ?? `Search ${resource.labelPlural.toLowerCase()}...`}
          bind:value={search}
          onkeydown={(e: KeyboardEvent) => e.key === "Enter" && handleSearch()}
        />
        <Button variant="secondary" onclick={handleSearch}>Search</Button>
      </div>
    {:else}
      <div></div>
    {/if}

    {#if resource.actions?.create !== false}
      <Button onclick={handleCreate}>
        Create {resource.label}
      </Button>
    {/if}
  </div>

  <!-- Error state -->
  {#if error}
    <div class="p-4 border rounded-lg border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
      {error}
    </div>
  {/if}

  <!-- Loading state -->
  {#if loading}
    <div class="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
      <div class="flex flex-col items-center gap-2">
        <div class="w-6 h-6 border-2 rounded-full animate-spin border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-200"></div>
        <span>Loading {resource.labelPlural.toLowerCase()}...</span>
      </div>
    </div>
  {:else if items.length === 0}
    <!-- Empty state -->
    <div class="py-12 text-center border rounded-lg border-slate-200 bg-white/40 dark:border-slate-800 dark:bg-slate-900/40">
      <div class="text-slate-500 dark:text-slate-400">
        No {resource.labelPlural.toLowerCase()} found.
      </div>
      {#if resource.actions?.create !== false}
        <div class="mt-4">
          <Button variant="secondary" onclick={handleCreate}>
            Create your first {resource.label.toLowerCase()}
          </Button>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Mobile: Card layout -->
    <div class="space-y-3 sm:hidden">
      {#each items as item}
        <div class="p-4 border rounded-lg border-slate-200 bg-white/40 dark:border-slate-800 dark:bg-slate-900/40">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              {#each resource.list.columns.filter(c => !c.hideOnMobile).slice(0, 3) as column}
                <div class={column === resource.list.columns[0] ? "font-medium text-slate-900 dark:text-slate-100" : "text-sm text-slate-500 mt-1"}>
                  {#if column.render === "badge"}
                    {@const value = getNestedValue(item, column.key)}
                    {#if Array.isArray(value)}
                      <div class="flex flex-wrap gap-1 mt-1">
                        {#each value as v}
                          <Badge variant={getBadgeVariant(v, column)}>{v}</Badge>
                        {/each}
                      </div>
                    {:else}
                      <Badge variant={getBadgeVariant(value, column)}>{formatCellValue(item, column)}</Badge>
                    {/if}
                  {:else}
                    {formatCellValue(item, column)}
                  {/if}
                </div>
              {/each}
            </div>
            {#if hasActions}
              <div class="flex gap-1">
                {#if resource.actions?.view !== false}
                  <Button variant="ghost" size="sm" onclick={() => handleView(item[resource.primaryKey])}>
                    View
                  </Button>
                {/if}
                {#if resource.actions?.update !== false}
                  <Button variant="outline" size="sm" onclick={() => handleEdit(item[resource.primaryKey])}>
                    Edit
                  </Button>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <!-- Desktop: Table layout -->
    <div class="hidden border rounded-lg border-slate-200 bg-white/40 dark:border-slate-800 dark:bg-slate-900/40 sm:block">
      <Table>
        <thead class="text-xs text-left uppercase text-slate-500 dark:text-slate-400">
          <tr>
            {#each resource.list.columns as column}
              <th class="px-4 py-3" style={column.width ? `width: ${column.width}` : ""}>
                {#if column.sortable}
                  <button
                    class="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    onclick={() => handleSort(column.key)}
                  >
                    {column.label}
                    {#if sortKey === column.key}
                      <span class="text-slate-900 dark:text-slate-100">
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    {/if}
                  </button>
                {:else}
                  {column.label}
                {/if}
              </th>
            {/each}
            {#if hasActions}
              <th class="px-4 py-3">Actions</th>
            {/if}
          </tr>
        </thead>
        <tbody class="text-sm">
          {#each items as item}
            <tr class="border-t border-slate-200 hover:bg-slate-100/50 dark:border-slate-800 dark:hover:bg-slate-800/30">
              {#each resource.list.columns as column}
                <td class="px-4 py-3">
                  {#if column.render === "badge"}
                    {@const value = getNestedValue(item, column.key)}
                    {#if Array.isArray(value)}
                      <div class="flex flex-wrap gap-1">
                        {#each value as v}
                          <Badge variant={getBadgeVariant(v, column)}>{v}</Badge>
                        {/each}
                      </div>
                    {:else}
                      <Badge variant={getBadgeVariant(value, column)}>{formatCellValue(item, column)}</Badge>
                    {/if}
                  {:else if column.render === "email"}
                    <a href={`mailto:${getNestedValue(item, column.key)}`} class="text-blue-600 hover:underline dark:text-blue-400">
                      {formatCellValue(item, column)}
                    </a>
                  {:else if column.render === "link" && column.linkTemplate}
                    <a href={column.linkTemplate.replace("{value}", getNestedValue(item, column.key))} class="text-blue-600 hover:underline dark:text-blue-400">
                      {formatCellValue(item, column)}
                    </a>
                  {:else}
                    {formatCellValue(item, column)}
                  {/if}
                </td>
              {/each}
              {#if hasActions}
                <td class="px-4 py-3">
                  <div class="flex gap-1">
                    {#if resource.actions?.view !== false}
                      <Button variant="ghost" size="sm" onclick={() => handleView(item[resource.primaryKey])}>
                        View
                      </Button>
                    {/if}
                    {#if resource.actions?.update !== false}
                      <Button variant="ghost" size="sm" onclick={() => handleEdit(item[resource.primaryKey])}>
                        Edit
                      </Button>
                    {/if}
                    {#if resource.actions?.delete !== false}
                      <Button variant="ghost" size="sm" onclick={() => confirmDelete(item[resource.primaryKey])}>
                        Delete
                      </Button>
                    {/if}
                  </div>
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </Table>
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="flex items-center justify-between px-2">
        <div class="text-sm text-slate-500 dark:text-slate-400">
          Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
        </div>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" onclick={handlePrevPage} disabled={page <= 1}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onclick={handleNextPage} disabled={page >= totalPages}>
            Next
          </Button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Delete confirmation dialog -->
<ConfirmDialog
  bind:open={deleteDialogOpen}
  title={`Delete ${resource.label}`}
  message={`Are you sure you want to delete this ${resource.label.toLowerCase()}? This action cannot be undone.`}
  confirmLabel="Delete"
  confirmVariant="destructive"
  loading={deleting}
  onConfirm={handleDelete}
  onCancel={() => { deleteDialogOpen = false; deleteId = null; }}
/>
