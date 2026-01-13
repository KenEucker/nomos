<!--
  Default Show Template

  This template wraps the AdminResourceShow island to render detail views.
  It receives a page module and delegates rendering to the existing island.

  Override this template by creating:
  - templates/<resource>/Show.svelte for resource-specific customization
  - plugins/<plugin>/templates/<resource>/Show.svelte for plugin overrides
-->
<script lang="ts">
  import AdminResourceShow from "../../islands/AdminResourceShow.svelte";
  import type { AdminResource } from "../../lib/resources/types";
  import type { ShowPageModule, ViewType, FormMode } from "../../lib/pages/types";

  interface Props {
    /** The resolved page module */
    module: ShowPageModule;
    /** The underlying resource definition */
    resource?: AdminResource;
    /** Route parameters */
    params?: { id?: string; mode?: FormMode };
    /** Navigation callback */
    onNavigate?: (to: string) => void;
    /** Modal open callback */
    onOpenModal?: (view: ViewType, id?: string, mode?: FormMode) => void;
    /** Modal close callback */
    onCloseModal?: () => void;
    /** Success callback */
    onSuccess?: (result?: unknown) => void;
    /** Error callback */
    onError?: (error: Error | unknown) => void;
  }

  let {
    module,
    resource,
    params = {},
    onNavigate,
    onOpenModal,
    onCloseModal,
    onSuccess,
    onError,
  }: Props = $props();

  const id = $derived(params.id ?? "");

  // Create a synthetic resource from the module if not provided
  const effectiveResource = $derived(resource ?? createResourceFromModule(module));

  function createResourceFromModule(mod: ShowPageModule): AdminResource {
    const routeBase = mod.navigation?.listUrl?.() ?? `/${mod.resourceId}`;

    return {
      id: mod.resourceId,
      label: mod.title,
      labelPlural: mod.title + "s",
      routeBase,
      primaryKey: "id",
      endpoints: {
        list: `/${mod.resourceId}`,
        get: `/${mod.resourceId}/{id}`,
        create: `/${mod.resourceId}`,
        update: `/${mod.resourceId}/{id}`,
        delete: `/${mod.resourceId}/{id}`,
      },
      list: {
        columns: [],
      },
      form: {
        fields: mod.fields,
      },
      actions: {
        create: false,
        view: true,
        update: true,
        delete: !!mod.actions?.delete,
      },
    };
  }

  function handleNavigate(path: string) {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  }
</script>

{#if id}
  <AdminResourceShow
    resource={effectiveResource}
    {id}
    onNavigate={handleNavigate}
  />
{:else}
  <div class="p-4 border rounded-lg border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
    No ID provided. Cannot display record.
  </div>
{/if}
