<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "./AppShell.svelte";
  import AdminResourceForm from "./AdminResourceForm.svelte";
  import { session, hasRole, type SessionUser } from "../lib/session";
  import type { AdminResource } from "../lib/resources/types";

  interface Props {
    resource: AdminResource;
    id: string;
  }

  let { resource, id }: Props = $props();

  let user = $state<SessionUser | null>(null);
  let ready = $state(false);

  const unsubscribe = session.subscribe((value) => (user = value));

  const handleSuccess = () => {
    // Navigate to the show page after successful update
    window.location.href = `${resource.routeBase}/${id}`;
  };

  const handleCancel = () => {
    window.location.href = `${resource.routeBase}/${id}`;
  };

  onMount(() => {
    const check = setInterval(() => {
      if (!user) return;
      clearInterval(check);
      if (resource.requiredRole && !hasRole(user, resource.requiredRole)) {
        window.location.href = "/admin";
        return;
      }
      ready = true;
    }, 100);
    return () => {
      unsubscribe();
      clearInterval(check);
    };
  });
</script>

<AppShell title={`Edit ${resource.label}`}>
  {#if ready}
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
  {:else}
    <div class="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
      <div class="flex flex-col items-center gap-2">
        <div class="w-6 h-6 border-2 rounded-full animate-spin border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-200"></div>
        <span>Loading...</span>
      </div>
    </div>
  {/if}
</AppShell>
