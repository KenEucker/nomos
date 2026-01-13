<!--
  Default Form Template

  This template wraps the AdminResourceForm island to render form views.
  It receives a page module and delegates rendering to the existing island.

  Override this template by creating:
  - templates/<resource>/Form.svelte for resource-specific customization
  - plugins/<plugin>/templates/<resource>/Form.svelte for plugin overrides
-->
<script lang="ts">
  import AdminResourceForm from "../../islands/AdminResourceForm.svelte";
  import type { AdminResource } from "../../lib/resources/types";
  import type { FormPageModule, ViewType, FormMode } from "../../lib/pages/types";

  interface Props {
    /** The resolved page module */
    module: FormPageModule;
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

  // Determine mode from params
  const mode = $derived<"create" | "edit">(params.mode ?? (params.id ? "edit" : "create"));
  const id = $derived(params.id ?? "");

  // Create a synthetic resource from the module if not provided
  const effectiveResource = $derived(resource ?? createResourceFromModule(module));

  function createResourceFromModule(mod: FormPageModule): AdminResource {
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
        fields: mod.form.fields,
      },
      actions: {
        create: !!mod.actions.create,
        view: true,
        update: !!mod.actions.update,
        delete: false,
      },
    };
  }

  function handleSuccess(data: unknown) {
    if (onSuccess) {
      onSuccess(data);
    } else if (onNavigate) {
      const listUrl = module.navigation?.listUrl?.();
      if (listUrl) {
        onNavigate(listUrl);
      }
    } else {
      const listUrl = module.navigation?.listUrl?.();
      if (listUrl) {
        window.location.href = listUrl;
      }
    }
  }

  function handleCancel() {
    if (onCloseModal) {
      onCloseModal();
    } else if (onNavigate) {
      const listUrl = module.navigation?.listUrl?.();
      if (listUrl) {
        onNavigate(listUrl);
      }
    } else {
      window.history.back();
    }
  }
</script>

<AdminResourceForm
  resource={effectiveResource}
  {mode}
  {id}
  onSuccess={handleSuccess}
  onCancel={handleCancel}
/>
