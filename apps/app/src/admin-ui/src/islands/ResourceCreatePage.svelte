<script lang="ts">
  import AdminResourceForm from "./AdminResourceForm.svelte";
  import type { AdminResource } from "../lib/resources/types";

  interface Props {
    resource: AdminResource;
  }

  let { resource }: Props = $props();

  const handleSuccess = (data: any) => {
    // Navigate to the show page after successful creation
    const id = data?.[resource.primaryKey] ?? data?.id;
    if (id) {
      window.location.href = `${resource.routeBase}/${id}`;
    } else {
      window.location.href = resource.routeBase;
    }
  };

  const handleCancel = () => {
    window.location.href = resource.routeBase;
  };
</script>

<div class="mb-4">
  <a href={resource.routeBase} class="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
    &larr; Back to {resource.labelPlural}
  </a>
</div>
<div class="border rounded-lg border-slate-200 bg-white/40 p-6 dark:border-slate-800 dark:bg-slate-900/40">
  <h2 class="text-lg font-semibold mb-6 text-slate-900 dark:text-slate-100">
    Create New {resource.label}
  </h2>
  <AdminResourceForm
    {resource}
    mode="create"
    onSuccess={handleSuccess}
    onCancel={handleCancel}
  />
</div>
