<script lang="ts">
  import AdminResourceList from "./AdminResourceList.svelte";
  import type { AdminResource } from "../lib/resources/types";

  interface Props {
    resource: AdminResource;
  }

  let { resource }: Props = $props();

  let ready = $state(true);
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
