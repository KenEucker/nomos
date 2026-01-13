<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "./AppShell.svelte";
  import Table from "../components/ui/table.svelte";
  import Button from "../components/ui/button.svelte";
  import Badge from "../components/ui/badge.svelte";
  import Input from "../components/ui/input.svelte";
  import Card from "../components/ui/card.svelte";
  import { apiGet } from "../lib/api";
  import { session, hasRole, type SessionUser } from "../lib/session";

  interface AuditEntry {
    timestamp: string;
    event: string;
    userId?: string;
    apiKeyId?: string;
    resource?: string;
    action?: string;
    details?: any;
    ip?: string;
    userAgent?: string;
  }

  let audit = $state<AuditEntry[]>([]);
  let loading = $state(true);
  let user = $state<SessionUser | null>(null);
  let search = $state("");
  let eventFilter = $state("");
  let expandedRow = $state<number | null>(null);

  const unsubscribe = session.subscribe((value) => (user = value));

  const loadAudit = async () => {
    loading = true;
    try {
      const response = await apiGet<{ audit: AuditEntry[] }>("/_/audit");
      audit = response.data?.audit ?? [];
    } catch (e) {
      console.error("Failed to load audit log", e);
    }
    loading = false;
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(date));
  };

  const toggleRow = (index: number) => {
    expandedRow = expandedRow === index ? null : index;
  };

  const exportToCsv = () => {
    const headers = ["Timestamp", "Event", "User ID", "API Key ID", "Resource", "Action", "IP"];
    const rows = filteredAudit.map((entry) => [
      entry.timestamp,
      entry.event,
      entry.userId ?? "",
      entry.apiKeyId ?? "",
      entry.resource ?? "",
      entry.action ?? "",
      entry.ip ?? ""
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueEvents = $derived([...new Set(audit.map((e) => e.event))].sort());

  const filteredAudit = $derived(
    audit
      .filter((entry) => {
        if (eventFilter && entry.event !== eventFilter) return false;
        if (search) {
          const searchLower = search.toLowerCase();
          return (
            entry.event.toLowerCase().includes(searchLower) ||
            entry.userId?.toLowerCase().includes(searchLower) ||
            entry.resource?.toLowerCase().includes(searchLower) ||
            entry.action?.toLowerCase().includes(searchLower)
          );
        }
        return true;
      })
      .reverse()
  );

  onMount(() => {
    const check = setInterval(async () => {
      if (!user) return;
      clearInterval(check);
      if (!hasRole(user, "admin")) {
        window.location.href = "/";
        return;
      }
      await loadAudit();
    }, 100);
    return () => {
      unsubscribe();
      clearInterval(check);
    };
  });
</script>

<AppShell title="Audit Log">
  <!-- Filters -->
  <div class="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:flex-wrap">
    <div class="flex flex-1 gap-2">
      <Input className="flex-1 sm:max-w-xs" placeholder="Search..." bind:value={search} />
      <select
        class="min-w-0 px-3 py-2 text-sm border rounded bg-slate-900 border-slate-700 text-slate-100"
        bind:value={eventFilter}
      >
        <option value="">All events</option>
        {#each uniqueEvents as event}
          <option value={event}>{event}</option>
        {/each}
      </select>
    </div>
    <div class="flex gap-2">
      <Button variant="outline" size="sm" onclick={loadAudit} className="flex-1 sm:flex-none">Refresh</Button>
      <Button variant="secondary" size="sm" onclick={exportToCsv} className="flex-1 sm:flex-none">Export</Button>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12 text-slate-400">
      <div class="flex flex-col items-center gap-2">
        <div class="w-6 h-6 border-2 rounded-full animate-spin border-slate-600 border-t-slate-200"></div>
        <span>Loading audit log...</span>
      </div>
    </div>
  {:else if filteredAudit.length === 0}
    <Card>
      <div class="py-8 text-center text-slate-400">
        No audit entries found.
      </div>
    </Card>
  {:else}
    <div class="mb-2 text-xs text-slate-500">Showing {filteredAudit.length} entries</div>

    <!-- Mobile: Card layout -->
    <div class="space-y-3 sm:hidden">
      {#each filteredAudit as entry, i}
        <div class="p-4 border rounded-lg border-slate-800 bg-slate-900/40">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <Badge variant="secondary">{entry.event}</Badge>
              <div class="mt-1 text-xs text-slate-500">{formatDate(entry.timestamp)}</div>
            </div>
          </div>
          <div class="mt-2 space-y-1 text-xs text-slate-400">
            {#if entry.userId}
              <div><span class="text-slate-500">User:</span> {entry.userId.slice(0, 12)}...</div>
            {:else if entry.apiKeyId}
              <div><span class="text-slate-500">API Key:</span> {entry.apiKeyId.slice(0, 12)}...</div>
            {/if}
            {#if entry.resource}
              <div><span class="text-slate-500">Resource:</span> {entry.resource}</div>
            {/if}
            {#if entry.action}
              <div><span class="text-slate-500">Action:</span> {entry.action}</div>
            {/if}
          </div>
          {#if entry.details}
            <div class="mt-2">
              <Button variant="ghost" size="sm" onclick={() => toggleRow(i)}>
                {expandedRow === i ? "Hide details" : "Show details"}
              </Button>
              {#if expandedRow === i}
                <pre class="p-2 mt-2 overflow-auto text-xs rounded text-slate-400 max-h-32 bg-slate-900">{JSON.stringify(entry.details, null, 2)}</pre>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Desktop: Table layout -->
    <div class="hidden border rounded-lg border-slate-800 bg-slate-900/40 sm:block">
      <Table>
        <thead class="text-xs text-left uppercase text-slate-400">
          <tr>
            <th class="px-4 py-3">Timestamp</th>
            <th class="px-4 py-3">Event</th>
            <th class="hidden px-4 py-3 md:table-cell">User / Key</th>
            <th class="hidden px-4 py-3 lg:table-cell">Resource</th>
            <th class="hidden px-4 py-3 lg:table-cell">Action</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="text-sm">
          {#each filteredAudit as entry, i}
            <tr class="border-t border-slate-800 hover:bg-slate-800/30">
              <td class="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                {formatDate(entry.timestamp)}
              </td>
              <td class="px-4 py-3">
                <Badge variant="secondary">{entry.event}</Badge>
              </td>
              <td class="hidden px-4 py-3 font-mono text-xs text-slate-400 md:table-cell">
                {#if entry.userId}
                  {entry.userId.slice(0, 8)}...
                {:else if entry.apiKeyId}
                  {entry.apiKeyId.slice(0, 8)}...
                {:else}
                  -
                {/if}
              </td>
              <td class="hidden px-4 py-3 text-slate-400 lg:table-cell">{entry.resource ?? "-"}</td>
              <td class="hidden px-4 py-3 text-slate-400 lg:table-cell">{entry.action ?? "-"}</td>
              <td class="px-4 py-3">
                {#if entry.details}
                  <Button variant="ghost" size="sm" onclick={() => toggleRow(i)}>
                    {expandedRow === i ? "Hide" : "Details"}
                  </Button>
                {/if}
              </td>
            </tr>
            {#if expandedRow === i && entry.details}
              <tr class="border-t border-slate-800 bg-slate-900/50">
                <td colspan="6" class="px-4 py-3">
                  <pre class="overflow-auto text-xs text-slate-400 max-h-48">{JSON.stringify(entry.details, null, 2)}</pre>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </Table>
    </div>
  {/if}
</AppShell>
