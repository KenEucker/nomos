<!--
  ResourceModal - Modal View Component

  This component renders a resource view (Form or Show) inside a modal dialog.
  It enables modal composability where List views can open Show/Form views
  without page navigation.

  Usage:
    <ResourceModal
      resourceId="users"
      view="Show"
      params={{ id: "123" }}
      open={true}
      onClose={() => ...}
    />
-->
<script lang="ts">
  import Dialog from "../components/ui/dialog.svelte";
  import Button from "../components/ui/button.svelte";
  import { normalizeResource, type AdminResourceInput } from "../lib/resources/types";
  import { resolvePageModule, type ViewType, type FormMode, type PageModule } from "../lib/pages";
  import { resolveTemplate, type ResolvedTemplate } from "../lib/templates";

  interface Props {
    /** Resource definition */
    definition: AdminResourceInput;
    /** Resource identifier */
    resourceId?: string;
    /** View type (typically Form or Show for modals) */
    view: ViewType;
    /** Route parameters */
    params?: { id?: string; mode?: FormMode };
    /** Whether the modal is open */
    open?: boolean;
    /** Close callback */
    onClose?: () => void;
    /** Success callback */
    onSuccess?: (result?: unknown) => void;
    /** Error callback */
    onError?: (error: Error | unknown) => void;
  }

  let {
    definition,
    resourceId,
    view,
    params = {},
    open = $bindable(false),
    onClose,
    onSuccess,
    onError,
  }: Props = $props();

  // State
  let loading = $state(true);
  let error = $state<string | null>(null);
  let pageModule = $state<PageModule | null>(null);
  let template = $state<ResolvedTemplate | null>(null);

  const resource = $derived(normalizeResource(definition));

  $effect(() => {
    if (resourceId && resourceId !== resource.id) {
      throw new Error(
        `ResourceModal: resourceId "${resourceId}" does not match definition id "${resource.id}".`
      );
    }
  });

  // Determine title based on view and mode
  const title = $derived(() => {
    if (!resource) return view;
    switch (view) {
      case "Form":
        return params.mode === "edit" ? `Edit ${resource.label}` : `Create ${resource.label}`;
      case "Show":
        return `${resource.label} Details`;
      default:
        return resource.label;
    }
  });

  // Load module and template when modal opens
  async function loadResources() {
    if (!open) return;

    loading = true;
    error = null;

    try {
      // Resolve page module
      pageModule = await resolvePageModule(resource, view, {}, params);

      // Try to resolve template
      const resolved = await resolveTemplate(resource.id, view);
      template = resolved.template;
    } catch (err: any) {
      error = err.message ?? "Failed to load view";
    } finally {
      loading = false;
    }
  }

  // Reload when modal opens or view/resource changes
  $effect(() => {
    if (open) {
      loadResources();
    }
  });

  function handleClose() {
    open = false;
    onClose?.();
  }

  function handleSuccess(result?: unknown) {
    onSuccess?.(result);
    handleClose();
  }

  const TemplateComponent = $derived(template?.component);
</script>

<Dialog bind:open onClose={handleClose} className="sm:max-w-2xl">
  <!-- Modal Header -->
  <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
      {title()}
    </h2>
    <Button variant="ghost" size="sm" onclick={handleClose}>
      <span class="sr-only">Close</span>
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </Button>
  </div>

  <!-- Modal Content -->
  {#if loading}
    <div class="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
      <div class="flex flex-col items-center gap-2">
        <div class="w-6 h-6 border-2 rounded-full animate-spin border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-200"></div>
        <span>Loading...</span>
      </div>
    </div>
  {:else if error}
    <div class="p-4 text-red-700 border border-red-200 rounded-lg bg-red-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
      <strong>Error:</strong> {error}
    </div>
  {:else if TemplateComponent && pageModule}
    <TemplateComponent
      module={pageModule}
      {resource}
      {params}
      onCloseModal={handleClose}
      onSuccess={handleSuccess}
      {onError}
    />
  {/if}
</Dialog>
