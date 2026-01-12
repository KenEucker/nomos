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
      const response = await apiGet<{ audit: AuditEntry[] }>("/admin/api/audit");
      audit = response.data?.audit ?? [];
    } catch (e) {
      console.error("Failed to load audit log", e);
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

  onMount(async () => {
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
  <div class="mb-4 flex items-center gap-3 flex-wrap">
    <Input className="max-w-sm" placeholder="Search audit log..." bind:value={search} />
    <select
      class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
      bind:value={eventFilter}
    >
      <option value="">All events</option>
      {#each uniqueEvents as event}
        <option value={event}>{event}</option>
      {/each}
    </select>
    <Button variant="outline" size="sm" onclick={loadAudit}>Refresh</Button>
    <Button variant="secondary" size="sm" onclick={exportToCsv}>Export CSV</Button>
  </div>

  {#if loading}
    <div class="text-slate-400">Loading audit log...</div>
  {:else if filteredAudit.length === 0}
    <Card>
      <div class="text-center py-8 text-slate-400">
        No audit entries found.
      </div>
    </Card>
  {:else}
    <div class="text-xs text-slate-500 mb-2">Showing {filteredAudit.length} entries</div>
    <Table>
      <thead class="text-left text-xs uppercase text-slate-400">
        <tr>
          <th class="pb-2">Timestamp</th>
          <th class="pb-2">Event</th>
          <th class="pb-2">User / API Key</th>
          <th class="pb-2">Resource</th>
          <th class="pb-2">Action</th>
          <th class="pb-2"></th>
        </tr>
      </thead>
      <tbody class="text-sm">
        {#each filteredAudit as entry, i}
          <tr class="border-t border-slate-800">
            <td class="py-3 text-xs text-slate-400 whitespace-nowrap">
              {formatDate(entry.timestamp)}
            </td>
            <td class="py-3">
              <Badge variant="secondary">{entry.event}</Badge>
            </td>
            <td class="py-3 text-xs text-slate-400 font-mono">
              {#if entry.userId}
                <span class="text-slate-300">user:</span> {entry.userId.slice(0, 8)}...
              {:else if entry.apiKeyId}
                <span class="text-slate-300">key:</span> {entry.apiKeyId.slice(0, 8)}...
              {:else}
                -
              {/if}
            </td>
            <td class="py-3 text-slate-400">{entry.resource ?? "-"}</td>
            <td class="py-3 text-slate-400">{entry.action ?? "-"}</td>
            <td class="py-3">
              {#if entry.details}
                <Button variant="ghost" size="sm" onclick={() => toggleRow(i)}>
                  {expandedRow === i ? "Hide" : "Details"}
                </Button>
              {/if}
            </td>
          </tr>
          {#if expandedRow === i && entry.details}
            <tr class="border-t border-slate-800 bg-slate-900/50">
              <td colspan="6" class="py-3 px-4">
                <pre class="text-xs text-slate-400 overflow-auto max-h-48">{JSON.stringify(entry.details, null, 2)}</pre>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </Table>
  {/if}
</AppShell>
