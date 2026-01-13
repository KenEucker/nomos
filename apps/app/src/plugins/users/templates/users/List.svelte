<!--
  Users Plugin - Custom List Template Override

  This template demonstrates how a plugin can override the default List template
  for a specific resource. In this case, we add a user statistics summary
  above the standard list view.

  Override resolution order:
  1. Plugin templates (this file) - HIGHEST PRIORITY
  2. Platform module templates
  3. Resource-specific templates
  4. Default templates

  This file: plugins/users/templates/users/List.svelte
  Takes priority over: templates/_default/List.svelte
-->
<script lang="ts">
  import { onMount } from "svelte";
  import AdminResourceList from "../../../../admin-ui/src/islands/AdminResourceList.svelte";
  import ResourceModal from "../../../../admin-ui/src/islands/ResourceModal.svelte";
  import Badge from "../../../../admin-ui/src/components/ui/badge.svelte";
  import { apiGet } from "../../../../admin-ui/src/lib/api";
  import type { AdminResource } from "../../../../admin-ui/src/lib/resources/types";
  import type { ListPageModule, ViewType, FormMode } from "../../../../admin-ui/src/lib/pages/types";

  interface Props {
    module: ListPageModule;
    resource?: AdminResource;
    params?: { id?: string; mode?: FormMode };
    onNavigate?: (to: string) => void;
    onOpenModal?: (view: ViewType, id?: string, mode?: FormMode) => void;
    onCloseModal?: () => void;
    onSuccess?: (result?: unknown) => void;
    onError?: (error: Error | unknown) => void;
    useModals?: boolean;
  }

  let {
    module,
    resource,
    params,
    onNavigate,
    onOpenModal,
    onCloseModal,
    onSuccess,
    onError,
    useModals = false,
  }: Props = $props();

  // User statistics state
  let stats = $state<{
    total: number;
    active: number;
    admins: number;
    recentlyCreated: number;
  } | null>(null);
  let statsLoading = $state(true);

  // Modal state (same as default template)
  let modalOpen = $state(false);
  let modalView = $state<ViewType>("Show");
  let modalParams = $state<{ id?: string; mode?: FormMode }>({});

  // Create effective resource from module
  const effectiveResource = $derived(resource ?? createResourceFromModule(module));

  function createResourceFromModule(mod: ListPageModule): AdminResource {
    return {
      id: mod.resourceId,
      label: mod.title.replace(/s$/, ""),
      labelPlural: mod.title,
      routeBase: mod.navigation?.createUrl?.()?.replace("/new", "") ?? `/${mod.resourceId}`,
      primaryKey: "id",
      endpoints: {
        list: `/${mod.resourceId}`,
        get: `/${mod.resourceId}/{id}`,
        create: `/${mod.resourceId}`,
        update: `/${mod.resourceId}/{id}`,
        delete: `/${mod.resourceId}/{id}`,
      },
      list: {
        columns: mod.list.columns,
        defaultSort: mod.list.defaultSort,
        filters: mod.list.filters,
        searchable: mod.list.searchable,
        searchPlaceholder: mod.list.searchPlaceholder,
        pageSize: mod.list.pageSize,
      },
      form: {
        fields: [],
      },
      actions: {
        create: true,
        view: true,
        update: true,
        delete: !!mod.actions?.delete,
      },
    };
  }

  // Load user statistics
  async function loadStats() {
    statsLoading = true;
    try {
      // Fetch all users to calculate stats
      // In a real app, you'd have a dedicated stats endpoint
      const response = await apiGet<any>("/users?pageSize=1000");
      const users = response.data?.users ?? [];

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      stats = {
        total: users.length,
        active: users.filter((u: any) => u.isActive !== false).length,
        admins: users.filter((u: any) =>
          u.roles?.some((r: string) => r === "admin" || r.includes("admin"))
        ).length,
        recentlyCreated: users.filter((u: any) =>
          new Date(u.createdAt) > thirtyDaysAgo
        ).length,
      };
    } catch (err) {
      console.error("Failed to load user stats:", err);
      stats = null;
    } finally {
      statsLoading = false;
    }
  }

  function handleNavigate(path: string) {
    if (useModals) {
      const resourceBase = effectiveResource.routeBase;
      const showMatch = path.match(new RegExp(`^${resourceBase}/([^/]+)$`));
      if (showMatch) {
        openModal("Show", showMatch[1]);
        return;
      }
      const editMatch = path.match(new RegExp(`^${resourceBase}/([^/]+)/edit$`));
      if (editMatch) {
        openModal("Form", editMatch[1], "edit");
        return;
      }
      if (path === `${resourceBase}/new`) {
        openModal("Form", undefined, "create");
        return;
      }
    }

    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  }

  function openModal(view: ViewType, id?: string, mode?: FormMode) {
    if (onOpenModal) {
      onOpenModal(view, id, mode);
      return;
    }
    modalView = view;
    modalParams = { id, mode };
    modalOpen = true;
  }

  function handleModalClose() {
    modalOpen = false;
    onCloseModal?.();
  }

  function handleModalSuccess(result?: unknown) {
    modalOpen = false;
    onSuccess?.(result);
    // Refresh stats after successful operation
    loadStats();
  }

  onMount(() => {
    loadStats();
  });
</script>

<!-- Plugin Enhancement: User Statistics Summary -->
<div class="mb-6">
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
    {#if statsLoading}
      {#each [1, 2, 3, 4] as _}
        <div class="p-4 border rounded-lg border-slate-200 bg-white/40 dark:border-slate-800 dark:bg-slate-900/40 animate-pulse">
          <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
          <div class="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
        </div>
      {/each}
    {:else if stats}
      <div class="p-4 border rounded-lg border-slate-200 bg-white/40 dark:border-slate-800 dark:bg-slate-900/40">
        <div class="text-sm text-slate-500 dark:text-slate-400">Total Users</div>
        <div class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{stats.total}</div>
      </div>

      <div class="p-4 border rounded-lg border-slate-200 bg-white/40 dark:border-slate-800 dark:bg-slate-900/40">
        <div class="text-sm text-slate-500 dark:text-slate-400">Active Users</div>
        <div class="flex items-center gap-2">
          <span class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{stats.active}</span>
          <Badge variant="success">
            {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
          </Badge>
        </div>
      </div>

      <div class="p-4 border rounded-lg border-slate-200 bg-white/40 dark:border-slate-800 dark:bg-slate-900/40">
        <div class="text-sm text-slate-500 dark:text-slate-400">Administrators</div>
        <div class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{stats.admins}</div>
      </div>

      <div class="p-4 border rounded-lg border-slate-200 bg-white/40 dark:border-slate-800 dark:bg-slate-900/40">
        <div class="text-sm text-slate-500 dark:text-slate-400">New (30 days)</div>
        <div class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{stats.recentlyCreated}</div>
      </div>
    {:else}
      <div class="col-span-full p-4 text-center text-slate-500 dark:text-slate-400">
        Failed to load statistics
      </div>
    {/if}
  </div>
</div>

<!-- Standard List Component -->
<AdminResourceList
  resource={effectiveResource}
  onNavigate={handleNavigate}
/>

<!-- Modal Host (same as default template) -->
{#if useModals && !onOpenModal}
  <ResourceModal
    resourceId={module.resourceId}
    view={modalView}
    params={modalParams}
    bind:open={modalOpen}
    onClose={handleModalClose}
    onSuccess={handleModalSuccess}
    {onError}
  />
{/if}
