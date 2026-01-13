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
  import { getResource } from "../lib/resources/registry";
  import { resolvePageModule, type ViewType, type FormMode, type PageModule } from "../lib/pages";
  import { resolveTemplate, type ResolvedTemplate } from "../lib/templates";

  // Import default templates for fallback
  import DefaultForm from "../templates/_default/Form.svelte";
  import DefaultShow from "../templates/_default/Show.svelte";

  interface Props {
    /** Resource identifier */
    resourceId: string;
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

  const resource = $derived(getResource(resourceId));

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
      pageModule = await resolvePageModule(resourceId, view);

      // Try to resolve template
      try {
        const resolved = await resolveTemplate(resourceId, view);
        template = resolved.template;
      } catch (templateError) {
        // Fall back to default templates
        template = {
          component: view === "Form" ? DefaultForm : DefaultShow,
          source: `_default/${view}.svelte`,
          type: "default",
        };
      }
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
  <div class="flex items-center justify-between mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
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
    <div class="p-4 border rounded-lg border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
      <strong>Error:</strong> {error}
    </div>
  {:else if TemplateComponent && pageModule}
    <svelte:component
      this={TemplateComponent}
      module={pageModule}
      {resource}
      {params}
      onCloseModal={handleClose}
      onSuccess={handleSuccess}
      {onError}
    />
  {/if}
</Dialog>
