<script lang="ts">
  import { onMount } from "svelte";
  import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "$ui/card"
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
    <CardHeader>
      <div class="flex flex-wrap items-center gap-2">
        <CardTitle>{plugin?.name ?? slug}</CardTitle>
        <Badge variant="secondary">{plugin?.status ?? "unknown"}</Badge>
        <Badge variant={plugin?.enabled ? "default" : "secondary"}>
          {plugin?.enabled ? "Enabled" : "Disabled"}
        </Badge>
      </div>
      <CardDescription>
        A plugin preview is a deterministic plan that lists the routes, admin pages, and permissions a plugin
        wants to add—without executing any side effects. Review the plan before enabling the plugin.
      </CardDescription>
    </CardHeader>
  </Card>

  {#if loading}
    <Card>
      <CardContent>
        <div class="py-6 text-center text-muted-foreground">Loading preview details…</div>
      </CardContent>
    </Card>
  {:else if error}
    <Card>
      <CardContent>
        <div class="py-6 text-center text-destructive">{error}</div>
      </CardContent>
    </Card>
  {:else if plugin}
    {#if plugin.lastError}
      <Card>
        <CardHeader>
          <CardTitle>Preview Error</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-sm text-destructive">{plugin.lastError}</div>
        </CardContent>
      </Card>
    {/if}

    {#if plugin.lastPreview}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent class="space-y-2">
          <p class="text-sm text-foreground">{plugin.lastPreview.summary ?? "No summary provided."}</p>
          {#if plugin.lastPreviewedAt}
            <div class="text-xs text-muted-foreground">Last previewed: {new Date(plugin.lastPreviewedAt).toLocaleString()}</div>
          {/if}
        </CardContent>
      </Card>

      {#if plugin.lastPreview.warnings?.length}
        <Card>
          <CardHeader>
            <CardTitle>Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <ul class="space-y-2 text-sm text-foreground list-disc list-outside ml-4">
              {#each plugin.lastPreview.warnings as warning}
                <li>{warning}</li>
              {/each}
            </ul>
          </CardContent>
        </Card>
      {/if}

      <Card>
        <CardHeader>
          <CardTitle>Requested Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          {#if plugin.lastPreview.permissionsRequested?.length}
            <div class="flex flex-wrap gap-2">
              {#each plugin.lastPreview.permissionsRequested as perm}
                <Badge variant="secondary">{perm}</Badge>
              {/each}
            </div>
          {:else}
            <div class="text-sm text-muted-foreground">No permissions requested.</div>
          {/if}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Routes</CardTitle>
        </CardHeader>
        <CardContent>
          {#if plugin.lastPreview.routes?.add?.length}
            <ul class="space-y-2 text-sm text-foreground">
              {#each plugin.lastPreview.routes.add as route}
                <li class="flex items-start gap-2">
                  <span class="font-mono text-xs text-muted-foreground font-medium">{route.method}</span>
                  <span class="font-mono text-xs text-foreground">{route.path}</span>
                  {#if route.description}
                    <span class="text-xs text-muted-foreground">— {route.description}</span>
                  {/if}
                </li>
              {/each}
            </ul>
          {:else}
            <div class="text-sm text-muted-foreground">No routes added.</div>
          {/if}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin Pages & Menu</CardTitle>
        </CardHeader>
        <CardContent>
          {#if plugin.lastPreview.admin?.pagesAdd?.length}
            <ul class="space-y-2 text-sm text-foreground">
              {#each plugin.lastPreview.admin.pagesAdd as page}
                <li class="flex items-start gap-2">
                  <span class="font-mono text-xs text-foreground">{page.path}</span>
                  <span class="text-xs text-muted-foreground">— {page.title}</span>
                </li>
              {/each}
            </ul>
          {:else}
            <div class="text-sm text-muted-foreground">No admin pages added.</div>
          {/if}
        </CardContent>
      </Card>

      {#if plugin.lastPreview.configKeys?.length}
        <Card>
          <CardHeader>
            <CardTitle>Configuration Keys</CardTitle>
          </CardHeader>
          <CardContent>
            <ul class="space-y-2 text-sm text-foreground">
              {#each plugin.lastPreview.configKeys as key}
                <li class="flex items-start gap-2 flex-wrap">
                  <span class="font-mono text-xs text-foreground">{key.key}</span>
                  {#if key.required}
                    <Badge variant="outline" class="border-amber-500 text-amber-700 dark:text-amber-400">Required</Badge>
                  {/if}
                  {#if key.description}
                    <span class="text-xs text-muted-foreground">— {key.description}</span>
                  {/if}
                </li>
              {/each}
            </ul>
          </CardContent>
        </Card>
      {/if}
    {:else}
      <Card>
        <CardContent>
          <div class="py-6 text-center text-muted-foreground">No preview results are available yet.</div>
        </CardContent>
      </Card>
    {/if}
  {:else}
    <Card>
      <CardContent>
        <div class="py-6 text-center text-muted-foreground">Plugin not found.</div>
      </CardContent>
    </Card>
  {/if}

  <div class="flex justify-end gap-2">
    <Button variant="default" size="sm" href="/admin/plugins">Back to plugins</Button>
  </div>
</div>
