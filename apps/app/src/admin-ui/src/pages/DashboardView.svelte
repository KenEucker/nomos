<script lang="ts">
  import { onMount } from "svelte";
  import Card from "../components/ui/card.svelte";
  import Table from "../components/ui/table.svelte";
  import Badge from "../components/ui/badge.svelte";
  import { apiGet } from "../lib/api";

  let counts = $state({ jobs: 0 });
  let usersCount = $state<number | null>(null);
  let recentJobs = $state<Array<any>>([]);
  let loading = $state(true);

  onMount(async () => {
    try {
      const [jobsRes] = await Promise.all([
        apiGet<{ jobs: any }>("/_/jobs?page=1&pageSize=5")
      ]);
      let usersTotal: number | null = null;
      try {
        const usersRes = await apiGet<{ users: any }>("/users?page=1&pageSize=1");
        console.log({ usersRes });
        usersTotal = usersRes.meta?.total ?? 0;
      } catch {
        usersTotal = null;
      }
      counts = {
        jobs: jobsRes.meta?.total ?? 0
      };
      usersCount = usersTotal;
    } finally {
      loading = false;
    }
  });
</script>

<div class="space-y-6">
  {#if loading}
    <div class="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
      <div class="flex flex-col items-center gap-2">
        <div class="w-6 h-6 border-2 rounded-full animate-spin border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-200"></div>
        <span>Loading dashboard...</span>
      </div>
    </div>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-slate-500 dark:text-slate-400">Jobs</div>
            <div class="text-2xl font-semibold sm:text-3xl">{counts.jobs}</div>
          </div>
          <div class="p-3 rounded-lg bg-slate-200 dark:bg-slate-800">
            <svg class="w-6 h-6 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
          </div>
        </div>
        <div class="mt-2 text-xs text-slate-500">Active jobs tracked in Nomos.</div>
      </Card>
      <Card className="sm:col-span-2 lg:col-span-1">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-slate-500 dark:text-slate-400">Users</div>
            <div class="text-2xl font-semibold sm:text-3xl">{usersCount ?? "—"}</div>
          </div>
          <div class="p-3 rounded-lg bg-slate-200 dark:bg-slate-800">
            <svg class="w-6 h-6 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
          </div>
        </div>
        <div class="mt-2 text-xs text-slate-500">People collaborating in Nomos.</div>
      </Card>
    </div>

    <div class="mt-6 border rounded-lg border-slate-200 bg-white/40 dark:border-slate-800 dark:bg-slate-900/40">
      <div class="px-4 py-3 border-b border-slate-200 dark:border-slate-800 sm:px-6">
        <h2 class="text-lg font-semibold">Recent Jobs</h2>
      </div>
      <div class="p-4 sm:p-6">
        {#if recentJobs.length === 0}
          <div class="py-8 text-center text-slate-500 dark:text-slate-400">No jobs yet.</div>
        {:else}
          <div class="space-y-3 sm:hidden">
            {#each recentJobs as job}
              <a
                href={`/admin/jobs/${job.id}`}
                class="block p-3 transition border rounded-lg border-slate-200 bg-slate-50/50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700"
              >
                <div class="flex items-center justify-between">
                  <div class="text-sm font-medium text-slate-900 dark:text-slate-100">{job.title}</div>
                  <Badge variant={job.status === "done" ? "success" : "secondary"}>
                    {job.status}
                  </Badge>
                </div>
              </a>
            {/each}
          </div>
          <div class="hidden sm:block">
            <Table>
              <thead class="text-xs text-left uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th class="pb-2">Title</th>
                  <th class="pb-2">Status</th>
                </tr>
              </thead>
              <tbody class="text-sm">
                {#each recentJobs as job}
                  <tr class="border-t border-slate-200 dark:border-slate-800">
                    <td class="py-3">
                      <a class="text-slate-900 hover:text-slate-700 dark:text-slate-100 dark:hover:text-white" href={`/admin/jobs/${job.id}`}>{job.title}</a>
                    </td>
                    <td class="py-3">
                      <Badge variant={job.status === "done" ? "success" : "secondary"}>
                        {job.status}
                      </Badge>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </Table>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
