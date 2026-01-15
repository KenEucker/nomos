<script lang="ts">
  import { onMount } from "svelte";
  import Table from "../../components/ui/table.svelte";
  import Button from "../../components/ui/button.svelte";
  import Dialog from "../../components/ui/dialog.svelte";
  import Badge from "../../components/ui/badge.svelte";
  import Card from "../../components/ui/card.svelte";
  import Tabs from "../../components/ui/tabs.svelte";
  import { apiGet, apiPost } from "../../lib/api";
  import { session, hasRole, type SessionUser } from "../../lib/session";

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
      const response = await apiGet<{ jobs: Job[]; runs: JobRun[] }>("/_/jobs");
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
      await apiPost("/_/jobs", { jobId: selectedJobId, payload });
      showTrigger = false;
      triggerPayload = "{}";
      await loadJobs();
    } catch (e) {
      console.error("Failed to trigger job", e);
    }
  };

  const retryJob = async (run: JobRun) => {
    try {
      await apiPost("/_/jobs", { jobId: run.jobId, payload: run.payload });
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
      dateStyle: "short",
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

  onMount(() => {
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

<div class="space-y-4">
  <!-- Controls -->
  <div class="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
    <Tabs tabs={[
      { id: "jobs", label: "Jobs" },
      { id: "runs", label: "Runs" }
    ]} bind:activeTab={activeTab} />
    <div class="flex items-center gap-2">
      <Button
        variant={autoRefresh ? "secondary" : "outline"}
        size="sm"
        onclick={toggleAutoRefresh}
        className="flex-1 sm:flex-none"
      >
        {autoRefresh ? "Auto ON" : "Auto OFF"}
      </Button>
      <Button variant="outline" size="sm" onclick={loadJobs} className="flex-1 sm:flex-none">
        Refresh
      </Button>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12 text-slate-400">
      <div class="flex flex-col items-center gap-2">
        <div class="w-6 h-6 border-2 rounded-full animate-spin border-slate-600 border-t-slate-200"></div>
        <span>Loading jobs...</span>
      </div>
    </div>
  {:else if activeTab === "jobs"}
    {#if jobs.length === 0}
      <Card>
        <div class="py-8 text-center text-slate-400">
          No jobs registered.
        </div>
      </Card>
    {:else}
      <!-- Mobile: Card layout -->
      <div class="space-y-3 sm:hidden">
        {#each jobs as job}
          <div class="p-4 border rounded-lg border-slate-800 bg-slate-900/40">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="font-mono text-sm truncate text-slate-100">{job.id}</div>
                <div class="mt-1 text-xs text-slate-500">Queue: {job.queue ?? "default"}</div>
              </div>
              <Button variant="outline" size="sm" onclick={() => openTrigger(job.id)}>
                Trigger
              </Button>
            </div>
            <div class="flex flex-wrap gap-2 mt-2 text-xs text-slate-400">
              <span>Concurrency: {job.concurrency ?? 1}</span>
              <span>Retries: {job.retries ?? 0}</span>
              {#if job.schedule}
                <span class="font-mono">{job.schedule}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- Desktop: Table layout -->
      <div class="hidden border rounded-lg border-slate-800 bg-slate-900/40 sm:block">
        <Table>
          <thead class="text-xs text-left uppercase text-slate-400">
            <tr>
              <th class="px-4 py-3">Job ID</th>
              <th class="px-4 py-3">Queue</th>
              <th class="hidden px-4 py-3 md:table-cell">Concurrency</th>
              <th class="hidden px-4 py-3 md:table-cell">Retries</th>
              <th class="hidden px-4 py-3 lg:table-cell">Schedule</th>
              <th class="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            {#each jobs as job}
              <tr class="border-t border-slate-800 hover:bg-slate-800/30">
                <td class="px-4 py-3 font-mono text-slate-100">{job.id}</td>
                <td class="px-4 py-3 text-slate-400">{job.queue ?? "default"}</td>
                <td class="hidden px-4 py-3 text-slate-400 md:table-cell">{job.concurrency ?? 1}</td>
                <td class="hidden px-4 py-3 text-slate-400 md:table-cell">{job.retries ?? 0}</td>
                <td class="hidden px-4 py-3 text-xs font-mono text-slate-400 lg:table-cell">{job.schedule ?? "-"}</td>
                <td class="px-4 py-3">
                  <Button variant="outline" size="sm" onclick={() => openTrigger(job.id)}>
                    Trigger
                  </Button>
                </td>
              </tr>
            {/each}
          </tbody>
        </Table>
      </div>
    {/if}
  {:else}
    {#if runs.length === 0}
      <Card>
        <div class="py-8 text-center text-slate-400">
          No job runs yet.
        </div>
      </Card>
    {:else}
      <Table>
        <thead class="text-xs text-left uppercase text-slate-400">
          <tr>
            <th class="pb-2">Job ID</th>
            <th class="pb-2">Status</th>
            <th class="pb-2">Started</th>
            <th class="pb-2">Duration</th>
            <th class="pb-2">Actions</th>
          </tr>
        </thead>
        <tbody class="text-sm">
          {#each runs.slice(-50).reverse() as run}
            <tr class="border-t border-slate-800">
              <td class="py-3 font-mono text-xs text-slate-400">{run.jobId}</td>
              <td class="py-3">
                <Badge variant={getStatusColor(run.status)}>{run.status}</Badge>
              </td>
              <td class="py-3 text-xs text-slate-400">{formatDate(run.startedAt)}</td>
              <td class="py-3 text-xs text-slate-400">{getDuration(run)}</td>
              <td class="py-3">
                {#if run.status === "failed"}
                  <Button variant="outline" size="sm" onclick={() => retryJob(run)}>
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
          <label for="job-id" class="block mb-1 text-sm text-slate-400">Job ID</label>
          <div id="job-id" class="p-2 font-mono text-sm truncate border rounded bg-slate-900 border-slate-700">
            {selectedJobId}
          </div>
        </div>
        <div>
          <label for="job-payload" class="block mb-1 text-sm text-slate-400">Payload (JSON)</label>
          <textarea
            id="job-payload"
            class="w-full h-32 p-2 font-mono text-sm border rounded resize-none bg-slate-900 border-slate-700 text-slate-100"
            bind:value={triggerPayload}
          ></textarea>
        </div>
      </div>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onclick={() => (showTrigger = false)}>Cancel</Button>
        <Button onclick={triggerJob}>Trigger</Button>
      </div>
    </div>
  </Dialog>
</div>
