<script lang="ts">
  import { onMount } from "svelte";
  import Card from "../components/ui/card.svelte";
  import Button from "../components/ui/button.svelte";
  import Badge from "../components/ui/badge.svelte";
  import Tabs from "../components/ui/tabs.svelte";
  import Table from "../components/ui/table.svelte";
  import { apiGet } from "../lib/api";
  import { session, hasRole, type SessionUser } from "../lib/session";

  interface DiagnosticsOverview {
    status: string;
    routes: number;
    jobs: number;
    events: string[];
  }

  interface RouteStats {
    routes: Array<{
      id: string;
      method: string;
      path: string;
    }>;
  }

  interface JobStats {
    jobs: Array<{
      id: string;
      queue?: string;
      schedule?: string;
    }>;
  }

  interface EventStats {
    events: string[];
  }

  let overview = $state<DiagnosticsOverview | null>(null);
  let routeStats = $state<RouteStats | null>(null);
  let jobStats = $state<JobStats | null>(null);
  let eventStats = $state<EventStats | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let user = $state<SessionUser | null>(null);
  let activeTab = $state("overview");
  let autoRefresh = $state(false);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  const unsubscribe = session.subscribe((value) => (user = value));

  const loadDiagnostics = async () => {
    try {
      error = null;
      const response = await apiGet<DiagnosticsOverview>("/_/diagnostics");
      overview = response.data ?? null;
    } catch (e: any) {
      if (e.message?.includes("Diagnostics disabled")) {
        error = "Diagnostics are disabled. Set DIAGNOSTICS_ENABLED=true to enable.";
      } else {
        error = "Failed to load diagnostics.";
      }
    }
    loading = false;
  };

  const loadRouteStats = async () => {
    try {
      const response = await apiGet<RouteStats>("/_/diagnostics/routes");
      routeStats = response.data ?? null;
    } catch {
      // ignore
    }
  };

  const loadJobStats = async () => {
    try {
      const response = await apiGet<JobStats>("/_/diagnostics/jobs");
      jobStats = response.data ?? null;
    } catch {
      // ignore
    }
  };

  const loadEventStats = async () => {
    try {
      const response = await apiGet<EventStats>("/_/diagnostics/events");
      eventStats = response.data ?? null;
    } catch {
      // ignore
    }
  };

  const loadAll = async () => {
    await Promise.all([loadDiagnostics(), loadRouteStats(), loadJobStats(), loadEventStats()]);
  };

  const toggleAutoRefresh = () => {
    autoRefresh = !autoRefresh;
    if (autoRefresh) {
      refreshInterval = setInterval(loadAll, 5000);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ok": return "bg-green-500";
      case "degraded": return "bg-yellow-500";
      case "error": return "bg-red-500";
      default: return "bg-slate-500";
    }
  };

  onMount(() => {
    const check = setInterval(async () => {
      if (!user) return;
      clearInterval(check);
      if (!hasRole(user, "admin")) {
        window.location.href = "/";
        return;
      }
      await loadAll();
    }, 100);
    return () => {
      unsubscribe();
      clearInterval(check);
      if (refreshInterval) clearInterval(refreshInterval);
    };
  });
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between mb-4">
    <Tabs tabs={[
      { id: "overview", label: "Overview" },
      { id: "routes", label: "Routes" },
      { id: "jobs", label: "Jobs" },
      { id: "events", label: "Events" }
    ]} bind:activeTab={activeTab} />
    <div class="flex items-center gap-2">
      <Button variant={autoRefresh ? "secondary" : "outline"} size="sm" onclick={toggleAutoRefresh}>
        {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
      </Button>
      <Button variant="outline" size="sm" onclick={loadAll}>Refresh</Button>
    </div>
  </div>

  {#if loading}
    <div class="text-slate-400">Loading diagnostics...</div>
  {:else if error}
    <Card>
      <div class="py-8 text-center">
        <div class="mb-2 text-red-400">{error}</div>
        <Button variant="outline" size="sm" onclick={loadDiagnostics}>Retry</Button>
      </div>
    </Card>
  {:else if activeTab === "overview"}
    <div class="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <div class="py-4 text-center">
          <div class="flex items-center justify-center gap-2 mb-2">
            <div class={"w-3 h-3 rounded-full " + getStatusColor(overview?.status ?? "unknown")}></div>
            <span class="text-sm text-slate-400">Status</span>
          </div>
          <div class="text-2xl font-semibold capitalize text-slate-100">
            {overview?.status ?? "Unknown"}
          </div>
        </div>
      </Card>
      <Card>
        <div class="py-4 text-center">
          <div class="mb-2 text-sm text-slate-400">Total Routes</div>
          <div class="text-2xl font-semibold text-slate-100">
            {overview?.routes ?? 0}
          </div>
        </div>
      </Card>
      <Card>
        <div class="py-4 text-center">
          <div class="mb-2 text-sm text-slate-400">Registered Jobs</div>
          <div class="text-2xl font-semibold text-slate-100">
            {overview?.jobs ?? 0}
          </div>
        </div>
      </Card>
      <Card>
        <div class="py-4 text-center">
          <div class="mb-2 text-sm text-slate-400">Event Types</div>
          <div class="text-2xl font-semibold text-slate-100">
            {overview?.events?.length ?? 0}
          </div>
        </div>
      </Card>
    </div>

    {#if overview?.events?.length}
      <Card>
        <h3 class="mb-3 text-sm font-semibold text-slate-300">Registered Events</h3>
        <div class="flex flex-wrap gap-2">
          {#each overview.events as event}
            <Badge variant="secondary">{event}</Badge>
          {/each}
        </div>
      </Card>
    {/if}
  {:else if activeTab === "routes"}
    {#if !routeStats?.routes?.length}
      <Card>
        <div class="py-8 text-center text-slate-400">No route data available.</div>
      </Card>
    {:else}
      <Table>
        <thead class="text-xs text-left uppercase text-slate-400">
          <tr>
            <th class="pb-2">Method</th>
            <th class="pb-2">Path</th>
            <th class="pb-2">ID</th>
          </tr>
        </thead>
        <tbody class="text-sm">
          {#each routeStats.routes as route}
            <tr class="border-t border-slate-800">
              <td class="py-2">
                <Badge variant="secondary">{route.method}</Badge>
              </td>
              <td class="py-2 font-mono text-slate-100">{route.path}</td>
              <td class="py-2 text-xs text-slate-400">{route.id}</td>
            </tr>
          {/each}
        </tbody>
      </Table>
    {/if}
  {:else if activeTab === "jobs"}
    {#if !jobStats?.jobs?.length}
      <Card>
        <div class="py-8 text-center text-slate-400">No job data available.</div>
      </Card>
    {:else}
      <Table>
        <thead class="text-xs text-left uppercase text-slate-400">
          <tr>
            <th class="pb-2">Job ID</th>
            <th class="pb-2">Queue</th>
            <th class="pb-2">Schedule</th>
          </tr>
        </thead>
        <tbody class="text-sm">
          {#each jobStats.jobs as job}
            <tr class="border-t border-slate-800">
              <td class="py-2 font-mono text-slate-100">{job.id}</td>
              <td class="py-2 text-slate-400">{job.queue ?? "default"}</td>
              <td class="py-2 font-mono text-xs text-slate-400">{job.schedule ?? "-"}</td>
            </tr>
          {/each}
        </tbody>
      </Table>
    {/if}
  {:else if activeTab === "events"}
    {#if !eventStats?.events?.length}
      <Card>
        <div class="py-8 text-center text-slate-400">No event data available.</div>
      </Card>
    {:else}
      <div class="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {#each eventStats.events as event}
          <div class="px-3 py-2 font-mono text-sm border rounded bg-slate-900/50 border-slate-800 text-slate-300">
            {event}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>
