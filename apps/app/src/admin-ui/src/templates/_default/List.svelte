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
  import AdminResourceList from "../../islands/AdminResourceList.svelte";
  import ResourceModal from "../../islands/ResourceModal.svelte";
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
</script>

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
