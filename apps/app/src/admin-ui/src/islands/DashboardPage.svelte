<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "./AppShell.svelte";
  import Card from "../components/ui/card.svelte";
  import Table from "../components/ui/table.svelte";
  import Badge from "../components/ui/badge.svelte";
  import { apiGet } from "../lib/api";

  let counts = $state({ projects: 0, tasks: 0 });
  let usersCount = $state<number | null>(null);
  let recentTasks = $state<Array<any>>([]);
  let loading = $state(true);

  onMount(async () => {
    try {
      const [projectsRes, tasksRes] = await Promise.all([
        apiGet<{ projects: any }>("/api/projects?page=1&pageSize=1"),
        apiGet<{ tasks: any }>("/api/tasks?page=1&pageSize=5")
      ]);
      let usersTotal: number | null = null;
      try {
        const usersRes = await apiGet<{ users: any }>("/api/users?page=1&pageSize=1");
        usersTotal = usersRes.meta?.total ?? 0;
      } catch {
        usersTotal = null;
      }
      counts = {
        projects: projectsRes.meta?.total ?? 0,
        tasks: tasksRes.meta?.total ?? 0
      };
      usersCount = usersTotal;
      recentTasks = tasksRes.data?.tasks ?? [];
    } finally {
      loading = false;
    }
  });
</script>

<AppShell title="Dashboard">
  {#if loading}
    <div class="flex items-center justify-center py-12 text-slate-400">
      <div class="flex flex-col items-center gap-2">
        <div class="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-slate-200"></div>
        <span>Loading dashboard...</span>
      </div>
    </div>
  {:else}
    <!-- Stats Grid - responsive: 1 col mobile, 2 col tablet, 3 col desktop -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-slate-400">Projects</div>
            <div class="text-2xl font-semibold sm:text-3xl">{counts.projects}</div>
          </div>
          <div class="rounded-lg bg-slate-800 p-3">
            <svg class="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
          </div>
        </div>
        <div class="mt-2 text-xs text-slate-500">Active projects tracked in Nomos.</div>
      </Card>
      <Card>
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-slate-400">Tasks</div>
            <div class="text-2xl font-semibold sm:text-3xl">{counts.tasks}</div>
          </div>
          <div class="rounded-lg bg-slate-800 p-3">
            <svg class="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
          </div>
        </div>
        <div class="mt-2 text-xs text-slate-500">Tasks across all projects.</div>
      </Card>
      <Card className="sm:col-span-2 lg:col-span-1">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-slate-400">Users</div>
            <div class="text-2xl font-semibold sm:text-3xl">{usersCount ?? "—"}</div>
          </div>
          <div class="rounded-lg bg-slate-800 p-3">
            <svg class="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
          </div>
        </div>
        <div class="mt-2 text-xs text-slate-500">People collaborating in Nomos.</div>
      </Card>
    </div>

    <!-- Recent Tasks -->
    <div class="mt-6 rounded-lg border border-slate-800 bg-slate-900/40">
      <div class="border-b border-slate-800 px-4 py-3 sm:px-6">
        <h2 class="text-lg font-semibold">Recent Tasks</h2>
      </div>
      <div class="p-4 sm:p-6">
        {#if recentTasks.length === 0}
          <div class="py-8 text-center text-slate-400">No tasks yet.</div>
        {:else}
          <!-- Mobile: Card layout -->
          <div class="space-y-3 sm:hidden">
            {#each recentTasks as task}
              <a
                href={`/tasks/${task.id}`}
                class="block rounded-lg border border-slate-800 bg-slate-900/50 p-3 transition hover:border-slate-700"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <div class="truncate font-medium text-slate-100">{task.title}</div>
                    <div class="mt-1 text-xs text-slate-500">Project: {task.projectId}</div>
                  </div>
                  <Badge variant={task.status === "done" ? "success" : "secondary"}>
                    {task.status}
                  </Badge>
                </div>
              </a>
            {/each}
          </div>
          <!-- Desktop: Table layout -->
          <div class="hidden sm:block">
            <Table>
              <thead class="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th class="pb-2">Title</th>
                  <th class="pb-2">Status</th>
                  <th class="pb-2">Project</th>
                </tr>
              </thead>
              <tbody class="text-sm">
                {#each recentTasks as task}
                  <tr class="border-t border-slate-800">
                    <td class="py-3">
                      <a class="text-slate-100 hover:text-white" href={`/tasks/${task.id}`}>{task.title}</a>
                    </td>
                    <td class="py-3">
                      <Badge variant={task.status === "done" ? "success" : "secondary"}>
                        {task.status}
                      </Badge>
                    </td>
                    <td class="py-3 text-slate-400">{task.projectId}</td>
                  </tr>
                {/each}
              </tbody>
            </Table>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</AppShell>
