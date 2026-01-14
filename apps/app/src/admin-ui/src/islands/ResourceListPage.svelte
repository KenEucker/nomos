<script lang="ts">
  import { onMount } from "svelte";
  import AdminResourceList from "./AdminResourceList.svelte";
  import { shell } from "../lib/shell";
  import { session, hasRole, type SessionUser } from "../lib/session";
  import type { AdminResource } from "../lib/resources/types";

  interface Props {
    resource: AdminResource;
  }

  let { resource }: Props = $props();

  let user = $state<SessionUser | null>(null);
  let ready = $state(false);

  $effect(() => {
    shell.set({ title: resource.labelPlural });
  });

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

{#if ready}
  <AdminResourceList {resource} />
{:else}
  <div class="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
    <div class="flex flex-col items-center gap-2">
      <div class="w-6 h-6 border-2 rounded-full animate-spin border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-200"></div>
      <span>Loading...</span>
    </div>
  </div>
{/if}
