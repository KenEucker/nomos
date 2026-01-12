<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "./AppShell.svelte";
  import Table from "../components/ui/table.svelte";
  import Button from "../components/ui/button.svelte";
  import Dialog from "../components/ui/dialog.svelte";
  import Badge from "../components/ui/badge.svelte";
  import Card from "../components/ui/card.svelte";
  import Tabs from "../components/ui/tabs.svelte";
  import { apiGet, apiPost } from "../lib/api";
  import { session, hasRole, type SessionUser } from "../lib/session";

  interface Job {
    id: string;
    queue?: string;
    concurrency?: number;
    retries?: number;
    timeoutMs?: number;
    schedule?: string;
  }

  interface JobRun {
    id: string;
    jobId: string;
    status: "queued" | "running" | "succeeded" | "failed";
    startedAt?: string;
    completedAt?: string;
    error?: string;
    payload?: any;
  }

  let jobs = $state<Job[]>([]);
  let runs = $state<JobRun[]>([]);
  let loading = $state(true);
  let user = $state<SessionUser | null>(null);
  let showTrigger = $state(false);
  let activeTab = $state("jobs");
  let autoRefresh = $state(false);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  let selectedJobId = $state("");
  let triggerPayload = $state("{}");

  const unsubscribe = session.subscribe((value) => (user = value));

  const loadJobs = async () => {
    try {
      const response = await apiGet<{ jobs: Job[]; runs: JobRun[] }>("/admin/api/jobs");
      jobs = response.data?.jobs ?? [];
      runs = response.data?.runs ?? [];
    } catch (e) {
      console.error("Failed to load jobs", e);
    }
    loading = false;
  };

  const triggerJob = async () => {
    try {
      let payload = {};
      try {
        payload = JSON.parse(triggerPayload);
      } catch {
        // ignore parse errors
      }
      await apiPost("/admin/api/jobs", { jobId: selectedJobId, payload });
      showTrigger = false;
      triggerPayload = "{}";
      await loadJobs();
    } catch (e) {
      console.error("Failed to trigger job", e);
    }
  };

  const retryJob = async (run: JobRun) => {
    try {
      await apiPost("/admin/api/jobs", { jobId: run.jobId, payload: run.payload });
      await loadJobs();
    } catch (e) {
      console.error("Failed to retry job", e);
    }
  };

  const openTrigger = (jobId: string) => {
    selectedJobId = jobId;
    triggerPayload = "{}";
    showTrigger = true;
  };

  const toggleAutoRefresh = () => {
    autoRefresh = !autoRefresh;
    if (autoRefresh) {
      refreshInterval = setInterval(loadJobs, 5000);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(date));
  };

  const getDuration = (run: JobRun) => {
    if (!run.startedAt) return "-";
    const start = new Date(run.startedAt).getTime();
    const end = run.completedAt ? new Date(run.completedAt).getTime() : Date.now();
    const ms = end - start;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "succeeded": return "success";
      case "failed": return "secondary";
      case "running": return "success";
      default: return "secondary";
    }
  };

  onMount(async () => {
    const check = setInterval(async () => {
      if (!user) return;
      clearInterval(check);
      if (!hasRole(user, "admin")) {
        window.location.href = "/";
        return;
      }
      await loadJobs();
    }, 100);
    return () => {
      unsubscribe();
      clearInterval(check);
      if (refreshInterval) clearInterval(refreshInterval);
    };
  });
</script>

<AppShell title="Jobs">
  <div class="mb-4 flex items-center justify-between">
    <Tabs tabs={[
      { id: "jobs", label: "Registered Jobs" },
      { id: "runs", label: "Recent Runs" }
    ]} bind:activeTab={activeTab} />
    <div class="flex items-center gap-2">
      <Button variant={autoRefresh ? "secondary" : "outline"} size="sm" onclick={toggleAutoRefresh}>
        {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
      </Button>
      <Button variant="outline" size="sm" onclick={loadJobs}>Refresh</Button>
    </div>
  </div>

  {#if loading}
    <div class="text-slate-400">Loading jobs...</div>
  {:else if activeTab === "jobs"}
    {#if jobs.length === 0}
      <Card>
        <div class="text-center py-8 text-slate-400">
          No jobs registered.
        </div>
      </Card>
    {:else}
      <Table>
        <thead class="text-left text-xs uppercase text-slate-400">
          <tr>
            <th class="pb-2">Job ID</th>
            <th class="pb-2">Queue</th>
            <th class="pb-2">Concurrency</th>
            <th class="pb-2">Retries</th>
            <th class="pb-2">Timeout</th>
            <th class="pb-2">Schedule</th>
            <th class="pb-2">Actions</th>
          </tr>
        </thead>
        <tbody class="text-sm">
          {#each jobs as job}
            <tr class="border-t border-slate-800">
              <td class="py-3 font-mono text-slate-100">{job.id}</td>
              <td class="py-3 text-slate-400">{job.queue ?? "default"}</td>
              <td class="py-3 text-slate-400">{job.concurrency ?? 1}</td>
              <td class="py-3 text-slate-400">{job.retries ?? 0}</td>
              <td class="py-3 text-slate-400">{job.timeoutMs ? `${job.timeoutMs}ms` : "-"}</td>
              <td class="py-3 text-xs text-slate-400 font-mono">{job.schedule ?? "-"}</td>
              <td class="py-3">
                <Button variant="ghost" size="sm" onclick={() => openTrigger(job.id)}>
                  Trigger
                </Button>
              </td>
            </tr>
          {/each}
        </tbody>
      </Table>
    {/if}
  {:else}
    {#if runs.length === 0}
      <Card>
        <div class="text-center py-8 text-slate-400">
          No job runs yet.
        </div>
      </Card>
    {:else}
      <Table>
        <thead class="text-left text-xs uppercase text-slate-400">
          <tr>
            <th class="pb-2">Job ID</th>
            <th class="pb-2">Status</th>
            <th class="pb-2">Started</th>
            <th class="pb-2">Duration</th>
            <th class="pb-2">Error</th>
            <th class="pb-2">Actions</th>
          </tr>
        </thead>
        <tbody class="text-sm">
          {#each runs.slice(-50).reverse() as run}
            <tr class="border-t border-slate-800">
              <td class="py-3 font-mono text-slate-100">{run.jobId}</td>
              <td class="py-3">
                <Badge variant={getStatusColor(run.status)}>{run.status}</Badge>
              </td>
              <td class="py-3 text-xs text-slate-400">{formatDate(run.startedAt)}</td>
              <td class="py-3 text-slate-400">{getDuration(run)}</td>
              <td class="py-3 text-xs text-red-400 max-w-xs truncate">
                {run.error ?? "-"}
              </td>
              <td class="py-3">
                {#if run.status === "failed"}
                  <Button variant="ghost" size="sm" onclick={() => retryJob(run)}>
                    Retry
                  </Button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </Table>
    {/if}
  {/if}

  <Dialog bind:open={showTrigger} onClose={() => (showTrigger = false)}>
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">Trigger Job</h2>
      <div class="space-y-3">
        <div>
          <label class="block text-sm text-slate-400 mb-1">Job ID</label>
          <div class="font-mono text-sm bg-slate-900 border border-slate-700 rounded p-2">
            {selectedJobId}
          </div>
        </div>
        <div>
          <label class="block text-sm text-slate-400 mb-1">Payload (JSON)</label>
          <textarea
            class="w-full h-32 bg-slate-900 border border-slate-700 rounded p-2 font-mono text-sm text-slate-100"
            bind:value={triggerPayload}
          ></textarea>
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <Button variant="ghost" onclick={() => (showTrigger = false)}>Cancel</Button>
        <Button onclick={triggerJob}>Trigger</Button>
      </div>
    </div>
  </Dialog>
</AppShell>
