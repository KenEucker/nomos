<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "./AppShell.svelte";
  import Table from "../components/ui/table.svelte";
  import Button from "../components/ui/button.svelte";
  import Input from "../components/ui/input.svelte";
  import Dialog from "../components/ui/dialog.svelte";
  import { apiGet, apiPost } from "../lib/api";
  import { session, hasRole, type SessionUser } from "../lib/session";

  let projects: Array<any> = [];
  let loading = true;
  let search = "";
  let page = 1;
  let pageSize = 10;
  let total = 0;
  let showCreate = false;
  let name = "";
  let description = "";
  let user: SessionUser | null = null;

  session.subscribe((value) => (user = value));

  const loadProjects = async () => {
    loading = true;
    const query = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...(search ? { search } : {})
    });
    const response = await apiGet<{ projects: any }>(`/api/projects?${query}`);
    projects = response.data?.projects ?? [];
    total = response.meta?.total ?? 0;
    loading = false;
  };

  const createProject = async () => {
    await apiPost("/api/projects", { name, description });
    name = "";
    description = "";
    showCreate = false;
    await loadProjects();
  };

  onMount(loadProjects);
</script>

<AppShell title="Projects">
  <div class="mb-4 flex flex-wrap items-center gap-3">
    <Input className="max-w-sm" placeholder="Search projects" bind:value={search} />
    <Button variant="secondary" on:click={loadProjects}>Search</Button>
    {#if hasRole(user, "editor") || hasRole(user, "admin")}
      <Button on:click={() => (showCreate = true)}>New project</Button>
    {/if}
  </div>

  {#if loading}
    <div class="text-slate-400">Loading projects...</div>
  {:else}
    <Table>
      <thead class="text-left text-xs uppercase text-slate-400">
        <tr>
          <th class="pb-2">Name</th>
          <th class="pb-2">Description</th>
          <th class="pb-2">Created</th>
        </tr>
      </thead>
      <tbody class="text-sm">
        {#each projects as project}
          <tr class="border-t border-slate-800">
            <td class="py-3 font-medium">
              <a class="text-slate-100 hover:text-white" href={`/projects/${project.id}`}>{project.name}</a>
            </td>
            <td class="py-3 text-slate-400">{project.description ?? "-"}</td>
            <td class="py-3 text-slate-500">{new Date(project.createdAt).toLocaleDateString()}</td>
          </tr>
        {/each}
      </tbody>
    </Table>

    <div class="mt-4 flex items-center justify-between text-sm text-slate-400">
      <div>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</div>
      <div class="space-x-2">
        <Button variant="ghost" size="sm" on:click={() => { if (page > 1) { page -= 1; loadProjects(); } }}>Prev</Button>
        <Button variant="ghost" size="sm" on:click={() => { if (page < Math.ceil(total / pageSize)) { page += 1; loadProjects(); } }}>Next</Button>
      </div>
    </div>
  {/if}

  <Dialog bind:open={showCreate} onClose={() => (showCreate = false)}>
    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold">Create project</h2>
        <p class="text-sm text-slate-400">Set a name and optional description.</p>
      </div>
      <div class="space-y-3">
        <Input placeholder="Project name" bind:value={name} />
        <Input placeholder="Description" bind:value={description} />
      </div>
      <div class="flex justify-end gap-2">
        <Button variant="ghost" on:click={() => (showCreate = false)}>Cancel</Button>
        <Button on:click={createProject} disabled={!name}>Create</Button>
      </div>
    </div>
  </Dialog>
</AppShell>
