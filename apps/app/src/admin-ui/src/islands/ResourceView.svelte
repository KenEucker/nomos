<!--
  ResourceView - Unified View Component

  This component is the bridge between page modules/templates and the UI.
  It resolves the appropriate page module and template, then renders the view.

  Usage:
    <ResourceView resourceId="users" view="List" />
    <ResourceView resourceId="users" view="Form" params={{ id: "123", mode: "edit" }} />
    <ResourceView resourceId="users" view="Show" params={{ id: "123" }} />
-->
<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "./AppShell.svelte";
  import { session, hasRole, type SessionUser } from "../lib/session";
  import { getResource } from "../lib/resources/registry";
  import { resolvePageModule, type ViewType, type FormMode, type PageModule } from "../lib/pages";
  import { resolveTemplate, type ResolvedTemplate } from "../lib/templates";

  // Import default templates statically for fallback
  import DefaultList from "../templates/_default/List.svelte";
  import DefaultForm from "../templates/_default/Form.svelte";
  import DefaultShow from "../templates/_default/Show.svelte";

  interface Props {
    /** Resource identifier */
    resourceId: string;
    /** View type */
    view: ViewType;
    /** Route parameters */
    params?: { id?: string; mode?: FormMode };
    /** Navigation callback */
    onNavigate?: (to: string) => void;
    /** Callback when view opens a modal */
    onOpenModal?: (view: ViewType, id?: string, mode?: FormMode) => void;
    /** Callback when modal closes */
    onCloseModal?: () => void;
    /** Success callback */
    onSuccess?: (result?: unknown) => void;
    /** Error callback */
    onError?: (error: Error | unknown) => void;
    /** Whether to wrap in AppShell (default: true) */
    withShell?: boolean;
  }

  let {
    resourceId,
    view,
    params = {},
    onNavigate,
    onOpenModal,
    onCloseModal,
    onSuccess,
    onError,
    withShell = true,
  }: Props = $props();

  // State
  let user = $state<SessionUser | null>(null);
  let ready = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let pageModule = $state<PageModule | null>(null);
  let template = $state<ResolvedTemplate | null>(null);

  const resource = $derived(getResource(resourceId));
  const title = $derived(() => {
    if (pageModule?.view === "Form" && resource) {
      return params.mode === "edit" ? `Edit ${resource.label}` : `Create ${resource.label}`;
    }
    if (pageModule) return pageModule.title;
    if (resource) {
      switch (view) {
        case "List":
          return resource.labelPlural;
        case "Form":
          return params.mode === "edit" ? `Edit ${resource.label}` : `Create ${resource.label}`;
        case "Show":
          return resource.label;
      }
    }
    return view;
  });

  const subtitle = $derived(pageModule?.subtitle);
  const breadcrumbs = $derived(pageModule?.breadcrumbs ?? []);
  const actions = $derived(pageModule?.pageActions ?? []);

  // Session subscription
  const unsubscribe = session.subscribe((value) => (user = value));

  // Load module and template
  async function loadResources() {
    loading = true;
    error = null;

    try {
      // Check authentication and authorization
      if (resource?.requiredRole && user && !hasRole(user, resource.requiredRole)) {
        window.location.href = "/admin";
        return;
      }

      // Resolve page module
      pageModule = await resolvePageModule(resourceId, view);

      // Try to resolve template (may fail if not set up)
      const resolved = await resolveTemplate(resourceId, view);
      template = resolved.template;

      ready = true;
    } catch (err: any) {
      error = err.message ?? "Failed to load view";
      console.error("ResourceView load error:", err);
    } finally {
      loading = false;
    }
  }

  // Handle navigation
  function handleNavigate(to: string) {
    if (onNavigate) {
      onNavigate(to);
    } else {
      window.location.href = to;
    }
  }

  onMount(() => {
    // Wait for session to be available
    const check = setInterval(() => {
      if (user === null) {
        // Still loading session, check if session store has initialized
        return;
      }
      clearInterval(check);
      loadResources();
    }, 100);

    // Fallback: if no user after 2s, assume public access
    const timeout = setTimeout(() => {
      clearInterval(check);
      loadResources();
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(check);
      clearTimeout(timeout);
    };
  });

  // Get the template component
  const TemplateComponent = $derived(template?.component);
</script>

{#if withShell}
  <AppShell title={title()} {subtitle} {breadcrumbs} actions={actions}>
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
    {:else if ready && TemplateComponent && pageModule}
      <svelte:component
        this={TemplateComponent}
        module={pageModule}
        {resource}
        {params}
        onNavigate={handleNavigate}
        {onOpenModal}
        {onCloseModal}
        {onSuccess}
        {onError}
      />
    {/if}
  </AppShell>
{:else}
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
  {:else if ready && TemplateComponent && pageModule}
    <svelte:component
      this={TemplateComponent}
      module={pageModule}
      {resource}
      {params}
      onNavigate={handleNavigate}
      {onOpenModal}
      {onCloseModal}
      {onSuccess}
      {onError}
    />
  {/if}
{/if}
