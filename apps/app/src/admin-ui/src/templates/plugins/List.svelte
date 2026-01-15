<script lang="ts">
  import AdminResourceList from "../../islands/AdminResourceList.svelte";
  import type { ListTemplateProps } from "../../lib/pages/types";

  let { module, resource, onNavigate }: ListTemplateProps = $props();
</script>

<div class="space-y-4">
  <div class="rounded-lg border border-slate-200 bg-white/60 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
    <p class="mb-2 font-semibold text-slate-700 dark:text-slate-200">What is a plugin preview?</p>
    <p>
      Plugin previews generate a deterministic plan of the routes, admin pages, and permissions a plugin
      wants to add without applying side effects. Review the preview details before enabling a plugin.
    </p>
  </div>

  <AdminResourceList resource={resource!} onNavigate={onNavigate} />
</div>
