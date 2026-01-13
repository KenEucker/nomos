<script lang="ts">
  import { onMount } from "svelte";
  import Button from "../components/ui/button.svelte";
  import Badge from "../components/ui/badge.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import { apiGet, apiDelete } from "../lib/api";
  import type { AdminResource, FieldDef } from "../lib/resources/types";
  import { resolveEndpoint, getFieldsForView } from "../lib/resources/types";

  interface Props {
    resource: AdminResource;
    id: string;
    onNavigate?: (path: string) => void;
  }

  let {
    resource,
    id,
    onNavigate
  }: Props = $props();

  let data = $state<Record<string, any> | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let deleteDialogOpen = $state(false);
  let deleting = $state(false);

  const fields = $derived(getFieldsForView(resource, "view"));

  const loadData = async () => {
    loading = true;
    error = null;
    try {
      const endpoint = resolveEndpoint(resource.endpoints.get, id);
      const response = await apiGet<any>(endpoint);
      const dataKey = resource.singleDataKey ?? resource.id.replace(/s$/, "");
      data = response.data?.[dataKey] ?? response.data;
    } catch (err: any) {
      error = err.message ?? "Failed to load data";
    } finally {
      loading = false;
    }
  };

  const navigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  };

  const handleEdit = () => {
    navigate(`${resource.routeBase}/${id}/edit`);
  };

  const handleBack = () => {
    navigate(resource.routeBase);
  };

  const confirmDelete = () => {
    deleteDialogOpen = true;
  };

  const handleDelete = async () => {
    deleting = true;
    try {
      const endpoint = resolveEndpoint(resource.endpoints.delete, id);
      await apiDelete(endpoint);
      deleteDialogOpen = false;
      navigate(resource.routeBase);
    } catch (err: any) {
      error = err.message ?? "Failed to delete";
      deleteDialogOpen = false;
    } finally {
      deleting = false;
    }
  };

  const formatValue = (field: FieldDef, value: any): string => {
    if (value === null || value === undefined) {
      return "-";
    }

    switch (field.type) {
      case "datetime":
        try {
          return new Date(value).toLocaleString();
        } catch {
          return String(value);
        }
      case "date":
        try {
          return new Date(value).toLocaleDateString();
        } catch {
          return String(value);
        }
      case "boolean":
        return value ? "Yes" : "No";
      case "json":
        try {
          return JSON.stringify(value, null, 2);
        } catch {
          return String(value);
        }
      case "password":
        return "••••••••";
      case "relation_many":
        if (Array.isArray(value)) {
          return value.join(", ");
        }
        return String(value);
      default:
        if (Array.isArray(value)) {
          return value.join(", ");
        }
        return String(value);
    }
  };

  const isArrayValue = (field: FieldDef, value: any): boolean => {
    return (field.type === "relation_many" || Array.isArray(value)) && Array.isArray(value);
  };

  onMount(() => {
    loadData();
  });
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <Button variant="ghost" onclick={handleBack}>
      &larr; Back to {resource.labelPlural}
    </Button>
    <div class="flex gap-2">
      {#if resource.actions?.update !== false}
        <Button variant="secondary" onclick={handleEdit}>
          Edit {resource.label}
        </Button>
      {/if}
      {#if resource.actions?.delete !== false}
        <Button variant="destructive" onclick={confirmDelete}>
          Delete
        </Button>
      {/if}
    </div>
  </div>

  {#if error}
    <div class="p-4 border rounded-lg border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
      {error}
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
      <div class="flex flex-col items-center gap-2">
        <div class="w-6 h-6 border-2 rounded-full animate-spin border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-200"></div>
        <span>Loading {resource.label.toLowerCase()}...</span>
      </div>
    </div>
  {:else if data}
    <div class="border rounded-lg border-slate-200 bg-white/40 dark:border-slate-800 dark:bg-slate-900/40">
      <div class="divide-y divide-slate-200 dark:divide-slate-800">
        {#each fields as field}
          <div class="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt class="text-sm font-medium text-slate-500 dark:text-slate-400">
              {field.label}
            </dt>
            <dd class="mt-1 text-sm text-slate-900 dark:text-slate-100 sm:col-span-2 sm:mt-0">
              {#if isArrayValue(field, data[field.name])}
                <div class="flex flex-wrap gap-1">
                  {#each data[field.name] as item}
                    <Badge variant="secondary">{item}</Badge>
                  {/each}
                  {#if data[field.name].length === 0}
                    <span class="text-slate-400">-</span>
                  {/if}
                </div>
              {:else if field.type === "json" && data[field.name]}
                <pre class="p-2 text-xs bg-slate-100 dark:bg-slate-800 rounded overflow-auto max-h-48">{formatValue(field, data[field.name])}</pre>
              {:else if field.type === "boolean"}
                <Badge variant={data[field.name] ? "success" : "secondary"}>
                  {formatValue(field, data[field.name])}
                </Badge>
              {:else}
                {formatValue(field, data[field.name])}
              {/if}
            </dd>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="py-12 text-center border rounded-lg border-slate-200 bg-white/40 dark:border-slate-800 dark:bg-slate-900/40">
      <div class="text-slate-500 dark:text-slate-400">
        {resource.label} not found.
      </div>
    </div>
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
  onCancel={() => { deleteDialogOpen = false; }}
/>
