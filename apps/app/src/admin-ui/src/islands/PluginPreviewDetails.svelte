<script lang="ts">
  import { onMount } from "svelte";
  import { card } from "$ui/card"
  import { Badge } from "$ui/badge"
  import { Button } from "$ui/button"
  import { apiGet } from "../lib/api";

  let { slug } = $props<{
    slug?: string;
  }>();

  type PluginPlan = {
    slug: string;
    version: string;
    summary?: string;
    warnings?: string[];
    permissionsRequested?: string[];
    routes?: {
      add?: Array<{ method: string; path: string; description?: string }>;
      remove?: Array<{ method: string; path: string }>;
    };
    admin?: {
      pagesAdd?: Array<{ path: string; title: string; description?: string }>;
      menuAdd?: Array<{ label: string; path: string; icon?: string }>;
    };
    configKeys?: Array<{ key: string; required?: boolean; description?: string }>;
  };

  type PluginRecord = {
    slug: string;
    name: string;
    status: string;
    enabled: boolean;
    version: string;
    description?: string | null;
    lastError?: string | null;
    lastPreview?: PluginPlan | null;
    lastPreviewedAt?: string | null;
  };

  let plugin = $state<PluginRecord | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const loadPreview = async () => {
    loading = true;
    error = null;
    try {
      const response = await apiGet<{ plugin: PluginRecord }>(`/plugins/${slug}`);
      plugin = response.data?.plugin ?? null;
    } catch (err: any) {
      error = err?.message ?? "Failed to load preview.";
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    loadPreview();
  });
</script>

<div class="space-y-4">
  <Card>
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="text-lg font-semibold text-slate-100">{plugin?.name ?? slug}</h2>
        <Badge variant="secondary">{plugin?.status ?? "unknown"}</Badge>
        <Badge variant={plugin?.enabled ? "success" : "secondary"}>
          {plugin?.enabled ? "Enabled" : "Disabled"}
        </Badge>
      </div>
      <p class="text-sm text-slate-300">
        A plugin preview is a deterministic plan that lists the routes, admin pages, and permissions a plugin
        wants to add—without executing any side effects. Review the plan before enabling the plugin.
      </p>
    </div>
  </Card>

  {#if loading}
    <Card>
      <div class="py-6 text-center text-slate-400">Loading preview details…</div>
    </Card>
  {:else if error}
    <Card>
      <div class="py-6 text-center text-red-400">{error}</div>
    </Card>
  {:else if plugin}
    {#if plugin.lastError}
      <Card>
        <h3 class="mb-2 text-sm font-semibold text-slate-300">Preview Error</h3>
        <div class="text-sm text-red-300">{plugin.lastError}</div>
      </Card>
    {/if}

    {#if plugin.lastPreview}
      <Card>
        <h3 class="mb-2 text-sm font-semibold text-slate-300">Summary</h3>
        <p class="text-sm text-slate-200">{plugin.lastPreview.summary ?? "No summary provided."}</p>
        {#if plugin.lastPreviewedAt}
          <div class="mt-2 text-xs text-slate-400">Last previewed: {new Date(plugin.lastPreviewedAt).toLocaleString()}</div>
        {/if}
      </Card>

      {#if plugin.lastPreview.warnings?.length}
        <Card>
          <h3 class="mb-2 text-sm font-semibold text-slate-300">Warnings</h3>
          <ul class="space-y-1 text-sm list-disc list-inside text-slate-200">
            {#each plugin.lastPreview.warnings as warning}
              <li>{warning}</li>
            {/each}
          </ul>
        </Card>
      {/if}

      <Card>
        <h3 class="mb-2 text-sm font-semibold text-slate-300">Requested Permissions</h3>
        {#if plugin.lastPreview.permissionsRequested?.length}
          <div class="flex flex-wrap gap-2">
            {#each plugin.lastPreview.permissionsRequested as perm}
              <Badge variant="secondary">{perm}</Badge>
            {/each}
          </div>
        {:else}
          <div class="text-sm text-slate-400">No permissions requested.</div>
        {/if}
      </Card>

      <Card>
        <h3 class="mb-2 text-sm font-semibold text-slate-300">Routes</h3>
        {#if plugin.lastPreview.routes?.add?.length}
          <ul class="space-y-1 text-sm text-slate-200">
            {#each plugin.lastPreview.routes.add as route}
              <li>
                <span class="font-mono text-xs text-slate-400">{route.method}</span>
                <span class="ml-2 font-mono text-xs text-slate-100">{route.path}</span>
                {#if route.description}
                  <span class="ml-2 text-xs text-slate-400">{route.description}</span>
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <div class="text-sm text-slate-400">No routes added.</div>
        {/if}
      </Card>

      <Card>
        <h3 class="mb-2 text-sm font-semibold text-slate-300">Admin Pages & Menu</h3>
        {#if plugin.lastPreview.admin?.pagesAdd?.length}
          <ul class="space-y-1 text-sm text-slate-200">
            {#each plugin.lastPreview.admin.pagesAdd as page}
              <li>
                <span class="font-mono text-xs text-slate-100">{page.path}</span>
                <span class="ml-2 text-xs text-slate-400">{page.title}</span>
              </li>
            {/each}
          </ul>
        {:else}
          <div class="text-sm text-slate-400">No admin pages added.</div>
        {/if}
      </Card>

      {#if plugin.lastPreview.configKeys?.length}
        <Card>
          <h3 class="mb-2 text-sm font-semibold text-slate-300">Configuration Keys</h3>
          <ul class="space-y-1 text-sm text-slate-200">
            {#each plugin.lastPreview.configKeys as key}
              <li>
                <span class="font-mono text-xs text-slate-100">{key.key}</span>
                {#if key.required}
                  <Badge variant="warning" className="ml-2">Required</Badge>
                {/if}
                {#if key.description}
                  <span class="ml-2 text-xs text-slate-400">{key.description}</span>
                {/if}
              </li>
            {/each}
          </ul>
        </Card>
      {/if}
    {:else}
      <Card>
        <div class="py-6 text-center text-slate-400">No preview results are available yet.</div>
      </Card>
    {/if}
  {:else}
    <Card>
      <div class="py-6 text-center text-slate-400">Plugin not found.</div>
    </Card>
  {/if}

  <div class="flex justify-end">
    <Button variant="outline" size="sm" onclick={() => history.back()}>Back to plugins</Button>
  </div>
</div>
