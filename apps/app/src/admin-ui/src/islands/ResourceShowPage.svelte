<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "./AppShell.svelte";
  import AdminResourceShow from "./AdminResourceShow.svelte";
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

<AppShell title={`${resource.label} Details`}>
  {#if ready}
    <AdminResourceShow {resource} {id} />
  {:else}
    <div class="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
      <div class="flex flex-col items-center gap-2">
        <div class="w-6 h-6 border-2 rounded-full animate-spin border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-200"></div>
        <span>Loading...</span>
      </div>
    </div>
  {/if}
</AppShell>
