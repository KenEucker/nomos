<!--
  Default List Template

  This template wraps the AdminResourceList island to render list views.
  It receives a page module and delegates rendering to the existing island.

  Features:
  - Modal composability: Can open Show/Form views in a modal via onOpenModal
  - Internal modal host: If onOpenModal is not provided, uses internal modal

  Override this template by creating:
  - templates/<resource>/List.svelte for resource-specific customization
  - plugins/<plugin>/templates/<resource>/List.svelte for plugin overrides
-->
<script lang="ts">
  import { onMount } from "svelte";
  import AdminResourceList from "../../islands/AdminResourceList.svelte";
  import ResourceModal from "../../islands/ResourceModal.svelte";
  import Table from "../../components/ui/table.svelte";
  import Card from "../../components/ui/card.svelte";
  import Badge from "../../components/ui/badge.svelte";
  import { toasts } from "../../lib/toast";
  import { normalizeResource, type AdminResource, type AdminResourceInput } from "../../lib/resources/types";
  import type { ListPageModule, ViewType, FormMode } from "../../lib/pages/types";

  interface Props {
    /** The resolved page module */
    module: ListPageModule;
    /** The underlying resource definition */
    resource?: AdminResource;
    /** Route parameters */
    params?: { id?: string; mode?: FormMode };
    /** Navigation callback */
    onNavigate?: (to: string) => void;
    /** Modal open callback (external modal host) */
    onOpenModal?: (view: ViewType, id?: string, mode?: FormMode) => void;
    /** Modal close callback */
    onCloseModal?: () => void;
    /** Success callback */
    onSuccess?: (result?: unknown) => void;
    /** Error callback */
    onError?: (error: Error | unknown) => void;
    /** Enable modal mode for Show/Form (default: false for full-page navigation) */
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

  // Internal modal state (used when useModals=true and no external onOpenModal)
  let modalOpen = $state(false);
  let modalView = $state<ViewType>("Show");
  let modalParams = $state<{ id?: string; mode?: FormMode }>({});

  // Create a synthetic resource from the module if not provided
  const effectiveResource = $derived(normalizeResource(resource ?? createResourceFromModule(module)));
  const isSectionedLayout = $derived(Boolean(module.list.sections?.length));
  const hasSummaryCards = $derived(Boolean(module.list.summaryCards));

  let sectionData = $state<Record<string, unknown> | null>(null);
  let sectionLoading = $state(false);
  let sectionError = $state<string | null>(null);

  function getNestedValue(obj: unknown, path: string | undefined): unknown {
    if (!path) return obj;
    return path.split(".").reduce((acc, part) => (acc as Record<string, unknown> | undefined)?.[part], obj);
  }

  function formatDateTime(value: string): string {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  function formatDate(value: string): string {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  }

  function formatCellValue(row: Record<string, unknown>, key: string, render?: string): string {
    const value = getNestedValue(row, key);

    if (value === null || value === undefined) {
      return "-";
    }

    switch (render) {
      case "datetime":
        return formatDateTime(String(value));
      case "date":
        return formatDate(String(value));
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
  }

  function getBadgeVariant(
    value: unknown,
    badgeVariants?: Record<string, string>
  ): "default" | "secondary" | "success" | "destructive" | "warning" {
    if (badgeVariants) {
      const key = String(value);
      const variant = badgeVariants[key];
      if (variant === "success" || variant === "destructive" || variant === "warning" || variant === "secondary") {
        return variant;
      }
    }
    if (value === true || value === "active" || value === "success") return "success";
    if (value === false || value === "inactive" || value === "failed" || value === "expired") return "destructive";
    return "default";
  }

  function createResourceFromModule(mod: ListPageModule): AdminResourceInput {
    return {
      id: mod.resourceId,
      label: mod.title.replace(/s$/, ""), // Rough singular
      labelPlural: mod.title,
      routeBase: mod.navigation?.createUrl?.()?.replace("/new", "") ?? `/${mod.resourceId}`,
      list: {
        columns: mod.list.columns,
        defaultSort: mod.list.defaultSort,
        filters: mod.list.filters,
        searchable: mod.list.searchable,
        searchPlaceholder: mod.list.searchPlaceholder,
        pageSize: mod.list.pageSize,
      },
      endpoints: {
        list: `/${mod.resourceId}`,
      },
    };
  }

  function handleNavigate(path: string) {
    // Check if we should intercept navigation for modal mode
    if (useModals) {
      const resourceBase = effectiveResource.routeBase;

      // Check if path is a show page: /resource/:id
      const showMatch = path.match(new RegExp(`^${resourceBase}/([^/]+)$`));
      if (showMatch) {
        openModal("Show", showMatch[1]);
        return;
      }

      // Check if path is an edit page: /resource/:id/edit
      const editMatch = path.match(new RegExp(`^${resourceBase}/([^/]+)/edit$`));
      if (editMatch) {
        openModal("Form", editMatch[1], "edit");
        return;
      }

      // Check if path is a create page: /resource/new
      if (path === `${resourceBase}/new`) {
        openModal("Form", undefined, "create");
        return;
      }
    }

    // Default navigation behavior
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  }

  function openModal(view: ViewType, id?: string, mode?: FormMode) {
    // Use external modal handler if provided
    if (onOpenModal) {
      onOpenModal(view, id, mode);
      return;
    }

    // Use internal modal
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
  }

  async function loadSectionedData() {
    sectionLoading = true;
    sectionError = null;

    try {
      const result = await module.query.list({ page: 1, pageSize: 1 });
      sectionData = (result.items?.[0] ?? {}) as Record<string, unknown>;
      const message = module.onSuccess?.({ result, context: { params: params ?? {}, query: {} } });
      if (message) {
        toasts.success(message);
      }
    } catch (err) {
      const message = module.onError?.({ error: err, context: { params: params ?? {}, query: {} } });
      if (typeof message === "string") {
        toasts.error(message);
      }
      sectionError = message && typeof message === "string"
        ? message
        : "Failed to load data.";
      sectionData = null;
    } finally {
      sectionLoading = false;
    }
  }

  onMount(() => {
    if (isSectionedLayout) {
      void loadSectionedData();
    }
  });
</script>

{#if isSectionedLayout}
  <div class="space-y-6">
    {#if sectionLoading}
      <div class="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
        <div class="flex flex-col items-center gap-2">
          <div class="w-6 h-6 border-2 rounded-full animate-spin border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-200"></div>
          <span>Loading {module.title.toLowerCase()}...</span>
        </div>
      </div>
    {:else if sectionError}
      <div class="p-4 text-red-700 border border-red-200 rounded-lg bg-red-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
        {sectionError}
      </div>
    {:else if sectionData}
      {#if hasSummaryCards}
        {@const cardConfig = module.list.summaryCards}
        {@const cards = Array.isArray(getNestedValue(sectionData, cardConfig?.dataKey ?? "cards"))
          ? (getNestedValue(sectionData, cardConfig?.dataKey ?? "cards") as Array<Record<string, unknown>>)
          : []}
        {#if cards.length > 0 && cardConfig}
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {#each cards as card}
              <Card>
                <div class="text-sm text-slate-500 dark:text-slate-400">
                  {getNestedValue(card, cardConfig.labelKey) ?? "-"}
                </div>
                <div class="text-2xl font-semibold sm:text-3xl">
                  {getNestedValue(card, cardConfig.valueKey) ?? "-"}
                </div>
                {#if cardConfig.descriptionKey}
                  <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {getNestedValue(card, cardConfig.descriptionKey) ?? ""}
                  </div>
                {/if}
              </Card>
            {/each}
          </div>
        {/if}
      {/if}

      {#if module.list.sections}
        <div class="space-y-6">
          {#each module.list.sections as section (section.id)}
            {@const rows = Array.isArray(getNestedValue(sectionData, section.dataKey))
              ? (getNestedValue(sectionData, section.dataKey) as Array<Record<string, unknown>>)
              : []}
            <div class="space-y-3">
              <div>
                <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">{section.title}</h3>
                {#if section.description}
                  <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{section.description}</p>
                {/if}
              </div>
              {#if rows.length === 0}
                <div class="py-10 text-center border rounded-lg border-slate-200 bg-white/40 dark:border-slate-800 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400">
                  {section.emptyMessage ?? "No data available."}
                </div>
              {:else}
                <div class="border rounded-lg border-slate-200 bg-white/40 dark:border-slate-800 dark:bg-slate-900/40">
                  <Table>
                    <thead class="text-xs text-left uppercase text-slate-500 dark:text-slate-400">
                      <tr>
                        {#each section.columns as column}
                          <th class="px-4 py-3" style={column.width ? `width: ${column.width};` : undefined}>
                            {column.label}
                          </th>
                        {/each}
                      </tr>
                    </thead>
                    <tbody class="text-sm">
                      {#each rows as row}
                        <tr class="border-t border-slate-200 dark:border-slate-800">
                          {#each section.columns as column}
                            <td class="px-4 py-3">
                              {#if column.render === "badge"}
                                <Badge variant={getBadgeVariant(getNestedValue(row, column.key), column.badgeVariants)}>
                                  {formatCellValue(row, column.key)}
                                </Badge>
                              {:else}
                                <span class={column.render === "json" ? "font-mono text-xs" : undefined}>
                                  {formatCellValue(row, column.key, column.render)}
                                </span>
                              {/if}
                            </td>
                          {/each}
                        </tr>
                      {/each}
                    </tbody>
                  </Table>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {/else}
  </div>
{:else}
  <AdminResourceList
    resource={effectiveResource}
    onNavigate={handleNavigate}
  />

  <!-- Internal modal host (used when useModals=true) -->
  {#if useModals && !onOpenModal}
    <ResourceModal
      definition={effectiveResource}
      view={modalView}
      params={modalParams}
      bind:open={modalOpen}
      onClose={handleModalClose}
      onSuccess={handleModalSuccess}
      {onError}
    />
  {/if}
{/if}
