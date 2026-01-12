<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "./AppShell.svelte";
  import Card from "../components/ui/card.svelte";
  import Table from "../components/ui/table.svelte";
  import Badge from "../components/ui/badge.svelte";
  import { apiGet } from "../lib/api";

  let counts = { projects: 0, tasks: 0 };
  let usersCount: number | null = null;
  let recentTasks: Array<any> = [];
  let loading = true;

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
    <div class="text-slate-400">Loading dashboard...</div>
  {:else}
    <div class="grid gap-6 md:grid-cols-3">
      <Card>
        <div slot="header">
          <div class="text-sm text-slate-400">Projects</div>
          <div class="text-3xl font-semibold">{counts.projects}</div>
        </div>
        <div class="text-xs text-slate-500">Active projects tracked in Nomos.</div>
      </Card>
      <Card>
        <div slot="header">
          <div class="text-sm text-slate-400">Tasks</div>
          <div class="text-3xl font-semibold">{counts.tasks}</div>
        </div>
        <div class="text-xs text-slate-500">Tasks across all projects.</div>
      </Card>
      <Card>
        <div slot="header">
          <div class="text-sm text-slate-400">Users</div>
          <div class="text-3xl font-semibold">{usersCount ?? "—"}</div>
        </div>
        <div class="text-xs text-slate-500">People collaborating in Nomos.</div>
      </Card>
    </div>

    <div class="mt-8 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
      <h2 class="text-lg font-semibold">Recent tasks</h2>
      <div class="mt-4">
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
    </div>
  {/if}
</AppShell>
