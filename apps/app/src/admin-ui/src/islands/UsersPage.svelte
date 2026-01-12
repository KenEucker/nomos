<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "./AppShell.svelte";
  import Table from "../components/ui/table.svelte";
  import Button from "../components/ui/button.svelte";
  import Dialog from "../components/ui/dialog.svelte";
  import Badge from "../components/ui/badge.svelte";
  import Input from "../components/ui/input.svelte";
  import { apiGet, apiPut } from "../lib/api";
  import { session, hasRole, type SessionUser } from "../lib/session";

  let users = $state<Array<any>>([]);
  let roles = $state<Array<any>>([]);
  let loading = $state(true);
  let showRoles = $state(false);
  let selectedUser = $state<any>(null);
  let selectedRoles = $state<string[]>([]);
  let user = $state<SessionUser | null>(null);
  let search = $state("");

  const unsubscribe = session.subscribe((value) => (user = value));

  const loadUsers = async () => {
    loading = true;
    const query = new URLSearchParams({
      page: "1",
      pageSize: "50",
      ...(search ? { search } : {})
    });
    const response = await apiGet<{ users: any }>(`/api/users?${query}`);
    users = response.data?.users ?? [];
    loading = false;
  };

  const loadRoles = async () => {
    const response = await apiGet<{ roles: any }>("/api/roles");
    roles = response.data?.roles ?? [];
  };

  const openRoles = async (entry: any) => {
    selectedUser = entry;
    selectedRoles = [...entry.roles];
    showRoles = true;
    if (!roles.length) {
      await loadRoles();
    }
  };

  const toggleRole = (role: string) => {
    if (selectedRoles.includes(role)) {
      selectedRoles = selectedRoles.filter((item) => item !== role);
    } else {
      selectedRoles = [...selectedRoles, role];
    }
  };

  const saveRoles = async () => {
    await apiPut(`/api/users/${selectedUser.id}/roles`, { roles: selectedRoles });
    showRoles = false;
    await loadUsers();
  };

  onMount(async () => {
    const check = setInterval(async () => {
      if (!user) return;
      clearInterval(check);
      if (!hasRole(user, "admin")) {
        window.location.href = "/";
        return;
      }
      await loadUsers();
    }, 100);
    return () => {
      unsubscribe();
      clearInterval(check);
    };
  });
</script>

<AppShell title="Users">
  <!-- Search -->
  <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
    <div class="flex flex-1 gap-2">
      <Input className="flex-1 sm:max-w-sm" placeholder="Search users" bind:value={search} />
      <Button variant="secondary" onclick={loadUsers}>Search</Button>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12 text-slate-400">
      <div class="flex flex-col items-center gap-2">
        <div class="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-slate-200"></div>
        <span>Loading users...</span>
      </div>
    </div>
  {:else if users.length === 0}
    <div class="rounded-lg border border-slate-800 bg-slate-900/40 py-12 text-center">
      <div class="text-slate-400">No users found.</div>
    </div>
  {:else}
    <!-- Mobile: Card layout -->
    <div class="space-y-3 sm:hidden">
      {#each users as entry}
        <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="font-medium text-slate-100">{entry.name}</div>
              <div class="text-sm text-slate-500 truncate">{entry.email}</div>
              <div class="mt-2 flex flex-wrap gap-1">
                {#each entry.roles as role}
                  <Badge variant={role === "admin" ? "success" : "secondary"}>{role}</Badge>
                {/each}
              </div>
            </div>
            <Button variant="outline" size="sm" onclick={() => openRoles(entry)}>
              Edit
            </Button>
          </div>
        </div>
      {/each}
    </div>

    <!-- Desktop: Table layout -->
    <div class="hidden rounded-lg border border-slate-800 bg-slate-900/40 sm:block">
      <Table>
        <thead class="text-left text-xs uppercase text-slate-400">
          <tr>
            <th class="px-4 py-3">User</th>
            <th class="px-4 py-3">Roles</th>
            <th class="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody class="text-sm">
          {#each users as entry}
            <tr class="border-t border-slate-800 hover:bg-slate-800/30">
              <td class="px-4 py-3">
                <div class="font-medium text-slate-100">{entry.name}</div>
                <div class="text-xs text-slate-500">{entry.email}</div>
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  {#each entry.roles as role}
                    <Badge variant={role === "admin" ? "success" : "secondary"}>{role}</Badge>
                  {/each}
                </div>
              </td>
              <td class="px-4 py-3">
                <Button variant="ghost" size="sm" onclick={() => openRoles(entry)}>
                  Edit roles
                </Button>
              </td>
            </tr>
          {/each}
        </tbody>
      </Table>
    </div>
  {/if}

  <Dialog bind:open={showRoles} onClose={() => (showRoles = false)}>
    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold">Update roles</h2>
        {#if selectedUser}
          <p class="text-sm text-slate-400">{selectedUser.name} ({selectedUser.email})</p>
        {/if}
      </div>
      <div class="flex flex-wrap gap-2">
        {#each roles as role}
          <Button
            variant={selectedRoles.includes(role.key) ? "secondary" : "outline"}
            size="sm"
            onclick={() => toggleRole(role.key)}
          >
            {role.name}
          </Button>
        {/each}
      </div>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onclick={() => (showRoles = false)}>Cancel</Button>
        <Button onclick={saveRoles}>Save</Button>
      </div>
    </div>
  </Dialog>
</AppShell>
