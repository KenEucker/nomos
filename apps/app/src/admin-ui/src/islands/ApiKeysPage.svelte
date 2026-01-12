<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "./AppShell.svelte";
  import Table from "../components/ui/table.svelte";
  import Button from "../components/ui/button.svelte";
  import Dialog from "../components/ui/dialog.svelte";
  import Badge from "../components/ui/badge.svelte";
  import Input from "../components/ui/input.svelte";
  import Card from "../components/ui/card.svelte";
  import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";
  import { session, hasRole, type SessionUser } from "../lib/session";

  interface ApiKey {
    id: string;
    name: string;
    hashedKey: string;
    permissions: string[];
    allowedHosts: string[];
    revoked: boolean;
    createdAt: string;
    token?: string;
  }

  let apiKeys = $state<ApiKey[]>([]);
  let loading = $state(true);
  let user = $state<SessionUser | null>(null);
  let showCreate = $state(false);
  let showToken = $state(false);
  let newToken = $state("");
  let newName = $state("");
  let newPermissions = $state("");
  let newAllowedHosts = $state("");
  let search = $state("");

  const unsubscribe = session.subscribe((value) => (user = value));

  const loadApiKeys = async () => {
    loading = true;
    try {
      const response = await apiGet<{ apiKeys: ApiKey[] }>("/admin/api/api-keys");
      apiKeys = response.data?.apiKeys ?? [];
    } catch (e) {
      console.error("Failed to load API keys", e);
    }
    loading = false;
  };

  const createApiKey = async () => {
    try {
      const body = {
        name: newName || "API Key",
        permissions: newPermissions ? newPermissions.split(",").map((s) => s.trim()) : [],
        allowedHosts: newAllowedHosts ? newAllowedHosts.split(",").map((s) => s.trim()) : []
      };
      const response = await apiPost<ApiKey>("/admin/api/api-keys", body);
      if (response.data?.token) {
        newToken = response.data.token;
        showCreate = false;
        showToken = true;
      }
      await loadApiKeys();
      newName = "";
      newPermissions = "";
      newAllowedHosts = "";
    } catch (e) {
      console.error("Failed to create API key", e);
    }
  };

  const rotateKey = async (id: string) => {
    try {
      const response = await apiPatch<ApiKey>(`/admin/api/api-keys/${id}`, { action: "rotate" });
      if (response.data?.token) {
        newToken = response.data.token;
        showToken = true;
      }
      await loadApiKeys();
    } catch (e) {
      console.error("Failed to rotate API key", e);
    }
  };

  const revokeKey = async (id: string) => {
    try {
      await apiPatch(`/admin/api/api-keys/${id}`, { action: "revoke" });
      await loadApiKeys();
    } catch (e) {
      console.error("Failed to revoke API key", e);
    }
  };

  const deleteKey = async (id: string) => {
    try {
      await apiDelete(`/admin/api/api-keys/${id}`);
      await loadApiKeys();
    } catch (e) {
      console.error("Failed to delete API key", e);
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(newToken);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(date));
  };

  const filteredKeys = $derived(
    apiKeys.filter((key) =>
      key.name.toLowerCase().includes(search.toLowerCase()) ||
      key.id.toLowerCase().includes(search.toLowerCase())
    )
  );

  onMount(async () => {
    const check = setInterval(async () => {
      if (!user) return;
      clearInterval(check);
      if (!hasRole(user, "admin")) {
        window.location.href = "/";
        return;
      }
      await loadApiKeys();
    }, 100);
    return () => {
      unsubscribe();
      clearInterval(check);
    };
  });
</script>

<AppShell title="API Keys">
  <!-- Search and Actions -->
  <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
    <div class="flex flex-1 gap-2">
      <Input className="flex-1 sm:max-w-sm" placeholder="Search API keys..." bind:value={search} />
    </div>
    <Button onclick={() => (showCreate = true)} className="w-full sm:w-auto">Create API Key</Button>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12 text-slate-400">
      <div class="flex flex-col items-center gap-2">
        <div class="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-slate-200"></div>
        <span>Loading API keys...</span>
      </div>
    </div>
  {:else if filteredKeys.length === 0}
    <Card>
      <div class="py-8 text-center text-slate-400">
        {#if search}
          No API keys matching "{search}"
        {:else}
          No API keys created yet.
        {/if}
      </div>
    </Card>
  {:else}
    <!-- Mobile: Card layout -->
    <div class="space-y-3 sm:hidden">
      {#each filteredKeys as key}
        <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="font-medium text-slate-100" class:line-through={key.revoked}>{key.name}</div>
              <div class="text-xs text-slate-500 font-mono">{key.id.slice(0, 8)}...</div>
            </div>
            <Badge variant={key.revoked ? "secondary" : "success"}>
              {key.revoked ? "Revoked" : "Active"}
            </Badge>
          </div>

          {#if key.permissions.length > 0}
            <div class="mt-2 flex flex-wrap gap-1">
              {#each key.permissions.slice(0, 2) as perm}
                <Badge variant="secondary">{perm}</Badge>
              {/each}
              {#if key.permissions.length > 2}
                <Badge variant="secondary">+{key.permissions.length - 2}</Badge>
              {/if}
            </div>
          {/if}

          <div class="mt-2 text-xs text-slate-500">{formatDate(key.createdAt)}</div>

          <div class="mt-3 flex flex-wrap gap-2">
            {#if !key.revoked}
              <Button variant="outline" size="sm" onclick={() => rotateKey(key.id)}>Rotate</Button>
              <Button variant="outline" size="sm" onclick={() => revokeKey(key.id)}>Revoke</Button>
            {/if}
            <Button variant="destructive" size="sm" onclick={() => deleteKey(key.id)}>Delete</Button>
          </div>
        </div>
      {/each}
    </div>

    <!-- Desktop: Table layout -->
    <div class="hidden rounded-lg border border-slate-800 bg-slate-900/40 sm:block">
      <Table>
        <thead class="text-left text-xs uppercase text-slate-400">
          <tr>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Permissions</th>
            <th class="px-4 py-3 hidden lg:table-cell">Allowed Hosts</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3 hidden md:table-cell">Created</th>
            <th class="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody class="text-sm">
          {#each filteredKeys as key}
            <tr class="border-t border-slate-800 hover:bg-slate-800/30">
              <td class="px-4 py-3">
                <div class="font-medium text-slate-100" class:line-through={key.revoked}>{key.name}</div>
                <div class="text-xs text-slate-500 font-mono">{key.id.slice(0, 8)}...</div>
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1">
                  {#each key.permissions.slice(0, 3) as perm}
                    <Badge variant="secondary">{perm}</Badge>
                  {/each}
                  {#if key.permissions.length > 3}
                    <Badge variant="secondary">+{key.permissions.length - 3}</Badge>
                  {/if}
                </div>
              </td>
              <td class="px-4 py-3 hidden lg:table-cell">
                <div class="text-xs text-slate-400">
                  {#if key.allowedHosts.length > 0}
                    {key.allowedHosts.slice(0, 2).join(", ")}
                    {#if key.allowedHosts.length > 2}
                      <span class="text-slate-500">+{key.allowedHosts.length - 2} more</span>
                    {/if}
                  {:else}
                    <span class="text-slate-500">Any host</span>
                  {/if}
                </div>
              </td>
              <td class="px-4 py-3">
                <Badge variant={key.revoked ? "secondary" : "success"}>
                  {key.revoked ? "Revoked" : "Active"}
                </Badge>
              </td>
              <td class="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">
                {formatDate(key.createdAt)}
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-1">
                  {#if !key.revoked}
                    <Button variant="ghost" size="sm" onclick={() => rotateKey(key.id)}>Rotate</Button>
                    <Button variant="ghost" size="sm" onclick={() => revokeKey(key.id)}>Revoke</Button>
                  {/if}
                  <Button variant="destructive" size="sm" onclick={() => deleteKey(key.id)}>Delete</Button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </Table>
    </div>
  {/if}

  <Dialog bind:open={showCreate} onClose={() => (showCreate = false)}>
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">Create API Key</h2>
      <div class="space-y-3">
        <div>
          <label for="key-name" class="block text-sm text-slate-400 mb-1">Name</label>
          <Input id="key-name" placeholder="My API Key" bind:value={newName} />
        </div>
        <div>
          <label for="key-perms" class="block text-sm text-slate-400 mb-1">Permissions (comma-separated)</label>
          <Input id="key-perms" placeholder="users.read, users.create" bind:value={newPermissions} />
        </div>
        <div>
          <label for="key-hosts" class="block text-sm text-slate-400 mb-1">Allowed Hosts (comma-separated)</label>
          <Input id="key-hosts" placeholder="example.com, api.example.com" bind:value={newAllowedHosts} />
        </div>
      </div>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onclick={() => (showCreate = false)}>Cancel</Button>
        <Button onclick={createApiKey}>Create</Button>
      </div>
    </div>
  </Dialog>

  <Dialog bind:open={showToken} onClose={() => (showToken = false)}>
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">API Key Created</h2>
      <p class="text-sm text-slate-400">
        Copy this token now. You won't be able to see it again.
      </p>
      <div class="bg-slate-900 border border-slate-700 rounded p-3 font-mono text-xs sm:text-sm break-all">
        {newToken}
      </div>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onclick={copyToken}>Copy to Clipboard</Button>
        <Button onclick={() => (showToken = false)}>Done</Button>
      </div>
    </div>
  </Dialog>
</AppShell>
