<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "./AppShell.svelte";
  import Table from "../components/ui/table.svelte";
  import Button from "../components/ui/button.svelte";
  import Input from "../components/ui/input.svelte";
  import Dialog from "../components/ui/dialog.svelte";
  import { apiGet, apiPost } from "../lib/api";
  import { session, hasRole, type SessionUser } from "../lib/session";

  let projects = $state<Array<any>>([]);
  let loading = $state(true);
  let search = $state("");
  let page = $state(1);
  let pageSize = 10;
  let total = $state(0);
  let showCreate = $state(false);
  let name = $state("");
  let description = $state("");
  let user = $state<SessionUser | null>(null);

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

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium"
    }).format(new Date(date));
  };

  onMount(loadProjects);
</script>

<AppShell title="Projects">
  <!-- Search and Actions -->
  <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
    <div class="flex flex-1 gap-2">
      <Input className="flex-1 sm:max-w-sm" placeholder="Search projects" bind:value={search} />
      <Button variant="secondary" onclick={loadProjects}>Search</Button>
    </div>
    {#if hasRole(user, "editor") || hasRole(user, "admin")}
      <Button onclick={() => (showCreate = true)} className="w-full sm:w-auto">New project</Button>
    {/if}
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12 text-slate-400">
      <div class="flex flex-col items-center gap-2">
        <div class="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-slate-200"></div>
        <span>Loading projects...</span>
      </div>
    </div>
  {:else if projects.length === 0}
    <div class="rounded-lg border border-slate-800 bg-slate-900/40 py-12 text-center">
      <div class="text-slate-400">No projects found.</div>
      {#if hasRole(user, "editor") || hasRole(user, "admin")}
        <Button className="mt-4" onclick={() => (showCreate = true)}>Create your first project</Button>
      {/if}
    </div>
  {:else}
    <!-- Mobile: Card layout -->
    <div class="space-y-3 sm:hidden">
      {#each projects as project}
        <a
          href={`/projects/${project.id}`}
          class="block rounded-lg border border-slate-800 bg-slate-900/40 p-4 transition hover:border-slate-700"
        >
          <div class="font-medium text-slate-100">{project.name}</div>
          {#if project.description}
            <div class="mt-1 text-sm text-slate-400 line-clamp-2">{project.description}</div>
          {/if}
          <div class="mt-2 text-xs text-slate-500">{formatDate(project.createdAt)}</div>
        </a>
      {/each}
    </div>

    <!-- Desktop: Table layout -->
    <div class="hidden rounded-lg border border-slate-800 bg-slate-900/40 sm:block">
      <Table>
        <thead class="text-left text-xs uppercase text-slate-400">
          <tr>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Description</th>
            <th class="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody class="text-sm">
          {#each projects as project}
            <tr class="border-t border-slate-800 hover:bg-slate-800/30">
              <td class="px-4 py-3 font-medium">
                <a class="text-slate-100 hover:text-white" href={`/projects/${project.id}`}>{project.name}</a>
              </td>
              <td class="px-4 py-3 text-slate-400">{project.description ?? "-"}</td>
              <td class="px-4 py-3 text-slate-500">{formatDate(project.createdAt)}</td>
            </tr>
          {/each}
        </tbody>
      </Table>
    </div>

    <!-- Pagination -->
    <div class="mt-4 flex flex-col items-center justify-between gap-3 text-sm text-slate-400 sm:flex-row">
      <div>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</div>
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onclick={() => { if (page > 1) { page -= 1; loadProjects(); } }}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onclick={() => { if (page < Math.ceil(total / pageSize)) { page += 1; loadProjects(); } }}
          disabled={page >= Math.ceil(total / pageSize)}
        >
          Next
        </Button>
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
        <div>
          <label for="project-name" class="mb-1 block text-sm text-slate-400">Name</label>
          <Input id="project-name" placeholder="Project name" bind:value={name} />
        </div>
        <div>
          <label for="project-desc" class="mb-1 block text-sm text-slate-400">Description</label>
          <Input id="project-desc" placeholder="Description (optional)" bind:value={description} />
        </div>
      </div>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onclick={() => (showCreate = false)}>Cancel</Button>
        <Button onclick={createProject} disabled={!name}>Create</Button>
      </div>
    </div>
  </Dialog>
</AppShell>
