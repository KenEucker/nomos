<script lang="ts">
  import { onMount } from "svelte";
  import Table from "../components/ui/table.svelte";
  import Button from "../components/ui/button.svelte";
  import Badge from "../components/ui/badge.svelte";
  import Input from "../components/ui/input.svelte";
  import Card from "../components/ui/card.svelte";
  import { apiGet } from "../lib/api";
  import { session, hasRole, type SessionUser } from "../lib/session";

  interface RouteEntry {
    id: string;
    method: string;
    path: string;
    owner?: string;
    config: {
      auth?: string;
      permissions?: string[];
      permissionsAny?: string[];
      roles?: string[];
      middleware?: string[];
      tags?: string[];
      summary?: string;
      description?: string;
      deprecated?: boolean;
    };
  }

  let routes = $state<RouteEntry[]>([]);
  let loading = $state(true);
  let user = $state<SessionUser | null>(null);
  let search = $state("");
  let methodFilter = $state("");
  let ownerFilter = $state("");

  const unsubscribe = session.subscribe((value) => (user = value));

  const loadRoutes = async () => {
    loading = true;
    try {
      const response = await apiGet<{ routes: RouteEntry[] }>("/_/routes");
      routes = response.data?.routes ?? [];
    } catch (e) {
      console.error("Failed to load routes", e);
    }
    loading = false;
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET": return "bg-green-600";
      case "POST": return "bg-blue-600";
      case "PUT": return "bg-yellow-600";
      case "PATCH": return "bg-orange-600";
      case "DELETE": return "bg-red-600";
      default: return "bg-slate-600";
    }
  };

  const uniqueMethods = $derived([...new Set(routes.map((r) => r.method.toUpperCase()))].sort());
  const uniqueOwners = $derived([...new Set(routes.map((r) => r.owner ?? "core"))].sort());

  const filteredRoutes = $derived(
    routes.filter((route) => {
      if (methodFilter && route.method.toUpperCase() !== methodFilter) return false;
      if (ownerFilter && (route.owner ?? "core") !== ownerFilter) return false;
      if (search) {
        const searchLower = search.toLowerCase();
        return (
          route.path.toLowerCase().includes(searchLower) ||
          route.id.toLowerCase().includes(searchLower) ||
          route.config.summary?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
  );

  const groupedRoutes = $derived(
    filteredRoutes.reduce((acc, route) => {
      const owner = route.owner ?? "core";
      if (!acc[owner]) acc[owner] = [];
      acc[owner].push(route);
      return acc;
    }, {} as Record<string, RouteEntry[]>)
  );

  onMount(() => {
    const check = setInterval(async () => {
      if (!user) return;
      clearInterval(check);
      if (!hasRole(user, "admin")) {
        window.location.href = "/";
        return;
      }
      await loadRoutes();
    }, 100);
    return () => {
      unsubscribe();
      clearInterval(check);
    };
  });
</script>

<div class="space-y-4">
  <div class="flex flex-wrap items-center gap-3 mb-4">
    <Input className="max-w-sm" placeholder="Search routes..." bind:value={search} />
    <select
      class="px-3 py-2 text-sm border rounded bg-slate-900 border-slate-700 text-slate-100"
      bind:value={methodFilter}
    >
      <option value="">All methods</option>
      {#each uniqueMethods as method}
        <option value={method}>{method}</option>
      {/each}
    </select>
    <select
      class="px-3 py-2 text-sm border rounded bg-slate-900 border-slate-700 text-slate-100"
      bind:value={ownerFilter}
    >
      <option value="">All owners</option>
      {#each uniqueOwners as owner}
        <option value={owner}>{owner}</option>
      {/each}
    </select>
    <Button variant="outline" size="sm" onclick={loadRoutes}>Refresh</Button>
  </div>

  {#if loading}
    <div class="text-slate-400">Loading routes...</div>
  {:else if filteredRoutes.length === 0}
    <Card>
      <div class="py-8 text-center text-slate-400">
        No routes found.
      </div>
    </Card>
  {:else}
    <div class="mb-4 text-xs text-slate-500">
      {filteredRoutes.length} routes across {Object.keys(groupedRoutes).length} owners
    </div>

    {#each Object.entries(groupedRoutes) as [owner, ownerRoutes]}
      <div class="mb-6">
        <h3 class="flex items-center gap-2 mb-2 text-sm font-semibold text-slate-300">
          <Badge variant="secondary">{owner}</Badge>
          <span class="text-slate-500">{ownerRoutes.length} routes</span>
        </h3>
        <Table>
          <thead class="text-xs text-left uppercase text-slate-400">
            <tr>
              <th class="w-20 pb-2">Method</th>
              <th class="pb-2">Path</th>
              <th class="pb-2">Auth</th>
              <th class="pb-2">Permissions</th>
              <th class="pb-2">Middleware</th>
              <th class="pb-2">Summary</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            {#each ownerRoutes as route}
              <tr class="border-t border-slate-800" class:opacity-50={route.config.deprecated}>
                <td class="py-2">
                  <span class={"px-2 py-0.5 rounded text-xs font-mono text-white " + getMethodColor(route.method)}>
                    {route.method.toUpperCase()}
                  </span>
                </td>
                <td class="py-2 font-mono text-sm text-slate-100">
                  {route.path}
                  {#if route.config.deprecated}
                    <Badge variant="secondary">deprecated</Badge>
                  {/if}
                </td>
                <td class="py-2 text-xs text-slate-400">
                  {route.config.auth ?? "required"}
                </td>
                <td class="py-2">
                  <div class="flex flex-wrap gap-1">
                    {#each (route.config.permissions ?? []).slice(0, 2) as perm}
                      <Badge variant="secondary">{perm}</Badge>
                    {/each}
                    {#if (route.config.permissions ?? []).length > 2}
                      <Badge variant="secondary">+{(route.config.permissions ?? []).length - 2}</Badge>
                    {/if}
                  </div>
                </td>
                <td class="py-2 text-xs text-slate-400">
                  {(route.config.middleware ?? []).join(", ") || "-"}
                </td>
                <td class="max-w-xs py-2 text-xs truncate text-slate-400">
                  {route.config.summary ?? "-"}
                </td>
              </tr>
            {/each}
          </tbody>
        </Table>
      </div>
    {/each}
  {/if}
</div>
