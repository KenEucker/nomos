<script lang="ts">
  import AdminResourceForm from "./AdminResourceForm.svelte";
  import type { AdminResource } from "../lib/resources/types";

  interface Props {
    resource: AdminResource;
    id: string;
  }

  let { resource, id }: Props = $props();

  const handleSuccess = () => {
    // Navigate to the show page after successful update
    window.location.href = `${resource.routeBase}/${id}`;
  };

  const handleCancel = () => {
    window.location.href = `${resource.routeBase}/${id}`;
  };
</script>

<div class="mb-4">
  <a href={`${resource.routeBase}/${id}`} class="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
    &larr; Back to {resource.label}
  </a>
</div>
<div class="border rounded-lg border-slate-200 bg-white/40 p-6 dark:border-slate-800 dark:bg-slate-900/40">
  <h2 class="text-lg font-semibold mb-6 text-slate-900 dark:text-slate-100">
    Edit {resource.label}
  </h2>
  <AdminResourceForm
    {resource}
    {id}
    mode="edit"
    onSuccess={handleSuccess}
    onCancel={handleCancel}
  />
</div>
