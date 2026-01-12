<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "./AppShell.svelte";
  import Table from "../components/ui/table.svelte";
  import Button from "../components/ui/button.svelte";
  import Input from "../components/ui/input.svelte";
  import Dialog from "../components/ui/dialog.svelte";
  import Badge from "../components/ui/badge.svelte";
  import { apiGet, apiPost } from "../lib/api";
  import { session, hasRole, type SessionUser } from "../lib/session";

  let { projectId = "" } = $props<{ projectId?: string }>();
  let project: any = null;
  let tasks: Array<any> = [];
  let loading = true;
  let showCreate = false;
  let title = "";
  let description = "";
  let user: SessionUser | null = null;

  session.subscribe((value) => (user = value));

  const loadProject = async () => {
    loading = true;
    const [projectRes, tasksRes] = await Promise.all([
      apiGet<{ project: any }>(`/api/projects/${projectId}`),
      apiGet<{ tasks: any }>(`/api/tasks?projectId=${projectId}&page=1&pageSize=50`)
    ]);
    project = projectRes.data?.project;
    tasks = tasksRes.data?.tasks ?? [];
    loading = false;
  };

  const createTask = async () => {
    await apiPost("/api/tasks", {
      projectId,
      title,
      description
    });
    title = "";
    description = "";
    showCreate = false;
    await loadProject();
  };

  onMount(loadProject);
</script>

<AppShell title={project ? project.name : "Project"}>
  {#if loading}
    <div class="text-slate-400">Loading project...</div>
  {:else if project}
    <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
      <h2 class="text-xl font-semibold">{project.name}</h2>
      <p class="mt-2 text-sm text-slate-400">{project.description ?? "No description."}</p>
      <div class="mt-4 text-xs text-slate-500">Created by {project.createdByUserId}</div>
    </div>

    <div class="mt-6 flex items-center justify-between">
      <h3 class="text-lg font-semibold">Tasks</h3>
      {#if hasRole(user, "editor") || hasRole(user, "admin")}
        <Button onclick={() => (showCreate = true)}>Add task</Button>
      {/if}
    </div>
    <div class="mt-4">
      <Table>
        <thead class="text-left text-xs uppercase text-slate-400">
          <tr>
            <th class="pb-2">Title</th>
            <th class="pb-2">Status</th>
            <th class="pb-2">Assigned</th>
          </tr>
        </thead>
        <tbody class="text-sm">
          {#each tasks as task}
            <tr class="border-t border-slate-800">
              <td class="py-3">
                <a class="text-slate-100 hover:text-white" href={`/tasks/${task.id}`}>{task.title}</a>
              </td>
              <td class="py-3">
                <Badge variant={task.status === "done" ? "success" : "secondary"}>{task.status}</Badge>
              </td>
              <td class="py-3 text-slate-400">{task.assignedToUserId ?? "Unassigned"}</td>
            </tr>
          {/each}
        </tbody>
      </Table>
    </div>
  {/if}

  <Dialog bind:open={showCreate} onClose={() => (showCreate = false)}>
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">Create task</h2>
      <div class="space-y-3">
        <Input placeholder="Task title" bind:value={title} />
        <Input placeholder="Description" bind:value={description} />
      </div>
      <div class="flex justify-end gap-2">
        <Button variant="ghost" onclick={() => (showCreate = false)}>Cancel</Button>
        <Button onclick={createTask} disabled={!title}>Create</Button>
      </div>
    </div>
  </Dialog>
</AppShell>
