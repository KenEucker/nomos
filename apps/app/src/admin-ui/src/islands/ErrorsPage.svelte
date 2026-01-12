<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "./AppShell.svelte";
  import Table from "../components/ui/table.svelte";
  import Button from "../components/ui/button.svelte";
  import Badge from "../components/ui/badge.svelte";
  import Card from "../components/ui/card.svelte";
  import { apiGet } from "../lib/api";
  import { session, hasRole, type SessionUser } from "../lib/session";

  interface ErrorEntry {
    timestamp: string;
    error: string;
    type?: string;
    source?: string;
    stack?: string;
    requestId?: string;
    routeId?: string;
  }

  let errors = $state<ErrorEntry[]>([]);
  let loading = $state(true);
  let user = $state<SessionUser | null>(null);
  let expandedRow = $state<number | null>(null);
  let typeFilter = $state("");

  const unsubscribe = session.subscribe((value) => (user = value));

  const loadErrors = async () => {
    loading = true;
    try {
      const response = await apiGet<{ errors: ErrorEntry[] }>("/admin/api/errors");
      errors = response.data?.errors ?? [];
    } catch (e) {
      console.error("Failed to load errors", e);
    }
    loading = false;
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "medium"
    }).format(new Date(date));
  };

  const toggleRow = (index: number) => {
    expandedRow = expandedRow === index ? null : index;
  };

  const getErrorType = (entry: ErrorEntry) => {
    if (entry.type) return entry.type;
    if (entry.error.includes("TypeError")) return "TypeError";
    if (entry.error.includes("ReferenceError")) return "ReferenceError";
    if (entry.error.includes("SyntaxError")) return "SyntaxError";
    return "Error";
  };

  const uniqueTypes = $derived([...new Set(errors.map((e) => getErrorType(e)))].sort());

  const filteredErrors = $derived(
    errors
      .filter((entry) => {
        if (typeFilter && getErrorType(entry) !== typeFilter) return false;
        return true;
      })
      .reverse()
  );

  const errorCounts = $derived(
    uniqueTypes.map((type) => ({
      type,
      count: errors.filter((e) => getErrorType(e) === type).length
    }))
  );

  onMount(async () => {
    const check = setInterval(async () => {
      if (!user) return;
      clearInterval(check);
      if (!hasRole(user, "admin")) {
        window.location.href = "/";
        return;
      }
      await loadErrors();
    }, 100);
    return () => {
      unsubscribe();
      clearInterval(check);
    };
  });
</script>

<AppShell title="Errors">
  <div class="mb-4 flex items-center gap-3 flex-wrap">
    <select
      class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
      bind:value={typeFilter}
    >
      <option value="">All types</option>
      {#each uniqueTypes as type}
        <option value={type}>{type}</option>
      {/each}
    </select>
    <Button variant="outline" size="sm" onclick={loadErrors}>Refresh</Button>
  </div>

  {#if errorCounts.length > 0}
    <div class="flex gap-2 mb-4 flex-wrap">
      {#each errorCounts as { type, count }}
        <div class="bg-slate-900/50 border border-slate-800 rounded px-3 py-1.5 text-sm">
          <span class="text-slate-400">{type}:</span>
          <Badge variant="secondary">{count}</Badge>
        </div>
      {/each}
    </div>
  {/if}

  {#if loading}
    <div class="text-slate-400">Loading errors...</div>
  {:else if filteredErrors.length === 0}
    <Card>
      <div class="text-center py-8 text-slate-400">
        No errors found. That's good!
      </div>
    </Card>
  {:else}
    <div class="text-xs text-slate-500 mb-2">Showing {filteredErrors.length} errors</div>
    <Table>
      <thead class="text-left text-xs uppercase text-slate-400">
        <tr>
          <th class="pb-2">Timestamp</th>
          <th class="pb-2">Type</th>
          <th class="pb-2">Message</th>
          <th class="pb-2">Source</th>
          <th class="pb-2"></th>
        </tr>
      </thead>
      <tbody class="text-sm">
        {#each filteredErrors as entry, i}
          <tr class="border-t border-slate-800">
            <td class="py-3 text-xs text-slate-400 whitespace-nowrap">
              {formatDate(entry.timestamp)}
            </td>
            <td class="py-3">
              <Badge variant="secondary">{getErrorType(entry)}</Badge>
            </td>
            <td class="py-3 text-red-400 max-w-md truncate">
              {entry.error}
            </td>
            <td class="py-3 text-xs text-slate-400 font-mono">
              {entry.source ?? entry.routeId ?? "-"}
            </td>
            <td class="py-3">
              {#if entry.stack}
                <Button variant="ghost" size="sm" onclick={() => toggleRow(i)}>
                  {expandedRow === i ? "Hide" : "Stack"}
                </Button>
              {/if}
            </td>
          </tr>
          {#if expandedRow === i && entry.stack}
            <tr class="border-t border-slate-800 bg-slate-900/50">
              <td colspan="5" class="py-3 px-4">
                <pre class="text-xs text-slate-400 overflow-auto max-h-64 whitespace-pre-wrap">{entry.stack}</pre>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </Table>
  {/if}
</AppShell>
