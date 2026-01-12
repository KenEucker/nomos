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

  let users: Array<any> = [];
  let roles: Array<any> = [];
  let loading = true;
  let showRoles = false;
  let selectedUser: any = null;
  let selectedRoles: string[] = [];
  let user: SessionUser | null = null;
  let search = "";

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
  <div class="mb-4 flex items-center gap-3">
    <Input className="max-w-sm" placeholder="Search users" bind:value={search} />
    <Button variant="secondary" onclick={loadUsers}>Search</Button>
  </div>

  {#if loading}
    <div class="text-slate-400">Loading users...</div>
  {:else}
    <Table>
      <thead class="text-left text-xs uppercase text-slate-400">
        <tr>
          <th class="pb-2">User</th>
          <th class="pb-2">Roles</th>
          <th class="pb-2">Actions</th>
        </tr>
      </thead>
      <tbody class="text-sm">
        {#each users as entry}
          <tr class="border-t border-slate-800">
            <td class="py-3">
              <div class="font-medium text-slate-100">{entry.name}</div>
              <div class="text-xs text-slate-500">{entry.email}</div>
            </td>
            <td class="py-3">
              <div class="flex flex-wrap gap-2">
                {#each entry.roles as role}
                  <Badge variant={role === "admin" ? "success" : "secondary"}>{role}</Badge>
                {/each}
              </div>
            </td>
            <td class="py-3">
              <Button variant="ghost" size="sm" onclick={() => openRoles(entry)}>
                Edit roles
              </Button>
            </td>
          </tr>
        {/each}
      </tbody>
    </Table>
  {/if}

  <Dialog bind:open={showRoles} onClose={() => (showRoles = false)}>
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">Update roles</h2>
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
      <div class="flex justify-end gap-2">
        <Button variant="ghost" onclick={() => (showRoles = false)}>Cancel</Button>
        <Button onclick={saveRoles}>Save</Button>
      </div>
    </div>
  </Dialog>
</AppShell>
