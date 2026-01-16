<script lang="ts">
  import { onMount } from "svelte";
  import Badge from "../../../../admin-ui/src/components/ui/badge.svelte";
  import Card from "../../../../admin-ui/src/components/ui/card.svelte";

  type VersionInfo = {
    apiVersion?: string;
    apiRevision?: string;
    platformVersion?: string;
    build?: string;
  };

  let loading = $state(true);
  let error = $state<string | null>(null);
  let healthStatus = $state<string | null>(null);
  let versionInfo = $state<VersionInfo | null>(null);

  const statusVariant = $derived(() => {
    if (loading) return "secondary";
    if (error) return "destructive";
    if (healthStatus === "ok" && versionInfo?.apiRevision) return "success";
    return "warning";
  });

  const statusLabel = $derived(() => {
    if (loading) return "Checking";
    if (error) return "Failed";
    if (healthStatus === "ok" && versionInfo?.apiRevision) return "Functional";
    return "Degraded";
  });

  const formatValue = (value: unknown, fallback = "—") => {
    if (value === null || value === undefined || value === "") return fallback;
    return String(value);
  };

  const runSdkTest = async () => {
    loading = true;
    error = null;
    try {
      const versionResponse = await fetch("/version");
      if (!versionResponse.ok) {
        throw new Error(`Version request failed (${versionResponse.status})`);
      }
      const versionSeed = (await versionResponse.json()) as VersionInfo;
      const apiRevision = versionSeed.apiRevision;
      if (!apiRevision) {
        throw new Error("Missing apiRevision from /version response");
      }

      const sdkModule = await import(`/sdk/client.js?rev=${apiRevision}`);
      const client = sdkModule.createNomosClient({
        baseUrl: window.location.origin,
        credentials: "include"
      });

      const [health, version] = await Promise.all([
        client.GET("/health"),
        client.GET("/version")
      ]);

      healthStatus = (health as { status?: string } | null)?.status ?? "unknown";
      versionInfo = version as VersionInfo;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to run SDK test";
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    void runSdkTest();
  });
</script>

<Card className="mb-6">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div class="space-y-1">
      <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        SDK API Test
      </div>
      <div class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Generated SDK health check
      </div>
      <div class="text-sm text-slate-500 dark:text-slate-400">
        Validates <span class="font-mono">/health</span> and <span class="font-mono">/version</span> through the SDK client.
      </div>
    </div>
    <Badge variant={statusVariant}>{statusLabel}</Badge>
  </div>

  <div class="mt-4 grid gap-4 text-sm sm:grid-cols-2">
    <div>
      <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Health</div>
      <div class="mt-1 text-base font-medium text-slate-900 dark:text-slate-100">
        {#if loading}
          Checking…
        {:else}
          {formatValue(healthStatus, "Unknown")}
        {/if}
      </div>
    </div>
    <div>
      <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">API Revision</div>
      <div class="mt-1 font-mono text-sm text-slate-700 dark:text-slate-200">
        {#if loading}
          Loading…
        {:else}
          {formatValue(versionInfo?.apiRevision)}
        {/if}
      </div>
    </div>
    <div>
      <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">API Version</div>
      <div class="mt-1 text-sm text-slate-700 dark:text-slate-200">
        {#if loading}
          Loading…
        {:else}
          {formatValue(versionInfo?.apiVersion)}
        {/if}
      </div>
    </div>
    <div>
      <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Platform</div>
      <div class="mt-1 text-sm text-slate-700 dark:text-slate-200">
        {#if loading}
          Loading…
        {:else}
          {formatValue(versionInfo?.platformVersion)}
        {/if}
      </div>
    </div>
  </div>

  {#if error}
    <div class="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200">
      {error}
    </div>
  {/if}
</Card>
