<script lang="ts">
  import { onMount } from "svelte";
  import Table from "../components/ui/table.svelte";
  import Button from "../components/ui/button.svelte";
  import Dialog from "../components/ui/dialog.svelte";
  import Badge from "../components/ui/badge.svelte";
  import Input from "../components/ui/input.svelte";
  import Card from "../components/ui/card.svelte";
  import Tabs from "../components/ui/tabs.svelte";
  import { apiGet, apiPost } from "../lib/api";
  import { session, hasRole, type SessionUser } from "../lib/session";
  import { toasts } from "../lib/toast";

  interface WebhookDestination {
    id: string;
    url: string;
    events: string[];
    secret?: string;
    headers?: Record<string, string>;
    retryPolicy?: { attempts: number; delayMs: number };
    createdAt: string;
  }

  interface WebhookDelivery {
    id: string;
    destinationId: string;
    event: string;
    status: "queued" | "delivered" | "failed";
    attempts: number;
    lastAttemptAt?: string;
    error?: string;
  }

  let destinations = $state<WebhookDestination[]>([]);
  let deliveries = $state<WebhookDelivery[]>([]);
  let loading = $state(true);
  let user = $state<SessionUser | null>(null);
  let showCreate = $state(false);
  let activeTab = $state("destinations");

  let newUrl = $state("");
  let newEvents = $state("");
  let newSecret = $state("");
  let newRetryAttempts = $state("3");
  let newRetryDelay = $state("1000");

  const unsubscribe = session.subscribe((value) => (user = value));

  const loadWebhooks = async () => {
    loading = true;
    try {
      const response = await apiGet<{ destinations: WebhookDestination[]; deliveries: WebhookDelivery[] }>("/_/webhooks");
      destinations = response.data?.destinations ?? [];
      deliveries = response.data?.deliveries ?? [];
    } catch (e: any) {
      console.error("Failed to load webhooks", e);
      toasts.error(e.message ?? "Failed to load webhooks");
    }
    loading = false;
  };

  const createWebhook = async () => {
    try {
      const body = {
        url: newUrl,
        events: newEvents.split(",").map((s) => s.trim()).filter(Boolean),
        secret: newSecret || undefined,
        retryPolicy: {
          attempts: parseInt(newRetryAttempts) || 3,
          delayMs: parseInt(newRetryDelay) || 1000
        }
      };
      await apiPost("/_/webhooks", body);
      showCreate = false;
      newUrl = "";
      newEvents = "";
      newSecret = "";
      newRetryAttempts = "3";
      newRetryDelay = "1000";
      await loadWebhooks();
      toasts.success("Webhook created successfully");
    } catch (e: any) {
      console.error("Failed to create webhook", e);
      toasts.error(e.message ?? "Failed to create webhook");
    }
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(date));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered": return "success";
      case "failed": return "secondary";
      default: return "secondary";
    }
  };

  onMount(() => {
    const check = setInterval(async () => {
      if (!user) return;
      clearInterval(check);
      if (!hasRole(user, "admin")) {
        window.location.href = "/";
        return;
      }
      await loadWebhooks();
    }, 100);
    return () => {
      unsubscribe();
      clearInterval(check);
    };
  });
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between mb-4">
    <Tabs tabs={[
      { id: "destinations", label: "Destinations" },
      { id: "deliveries", label: "Delivery Log" }
    ]} bind:activeTab={activeTab} />
    <Button onclick={() => (showCreate = true)}>Add Webhook</Button>
  </div>

  {#if loading}
    <div class="text-slate-400">Loading webhooks...</div>
  {:else if activeTab === "destinations"}
    {#if destinations.length === 0}
      <Card>
        <div class="py-8 text-center text-slate-400">
          No webhook destinations configured.
        </div>
      </Card>
    {:else}
      <Table>
        <thead class="text-xs text-left uppercase text-slate-400">
          <tr>
            <th class="pb-2">URL</th>
            <th class="pb-2">Events</th>
            <th class="pb-2">Secret</th>
            <th class="pb-2">Retry Policy</th>
            <th class="pb-2">Created</th>
          </tr>
        </thead>
        <tbody class="text-sm">
          {#each destinations as dest}
            <tr class="border-t border-slate-800">
              <td class="py-3">
                <div class="max-w-xs font-mono text-sm truncate text-slate-100">{dest.url}</div>
                <div class="text-xs text-slate-500">{dest.id.slice(0, 8)}...</div>
              </td>
              <td class="py-3">
                <div class="flex flex-wrap gap-1">
                  {#each dest.events.slice(0, 2) as event}
                    <Badge variant="secondary">{event}</Badge>
                  {/each}
                  {#if dest.events.length > 2}
                    <Badge variant="secondary">+{dest.events.length - 2}</Badge>
                  {/if}
                </div>
              </td>
              <td class="py-3 text-slate-400">
                {dest.secret ? "********" : "-"}
              </td>
              <td class="py-3 text-xs text-slate-400">
                {dest.retryPolicy?.attempts ?? 3} attempts
              </td>
              <td class="py-3 text-xs text-slate-400">
                {formatDate(dest.createdAt)}
              </td>
            </tr>
          {/each}
        </tbody>
      </Table>
    {/if}
  {:else}
    {#if deliveries.length === 0}
      <Card>
        <div class="py-8 text-center text-slate-400">
          No webhook deliveries yet.
        </div>
      </Card>
    {:else}
      <Table>
        <thead class="text-xs text-left uppercase text-slate-400">
          <tr>
            <th class="pb-2">Event</th>
            <th class="pb-2">Destination</th>
            <th class="pb-2">Status</th>
            <th class="pb-2">Attempts</th>
            <th class="pb-2">Last Attempt</th>
          </tr>
        </thead>
        <tbody class="text-sm">
          {#each deliveries.slice(-50).reverse() as delivery}
            <tr class="border-t border-slate-800">
              <td class="py-3">
                <Badge variant="secondary">{delivery.event}</Badge>
              </td>
              <td class="py-3 font-mono text-xs text-slate-400">
                {delivery.destinationId.slice(0, 8)}...
              </td>
              <td class="py-3">
                <Badge variant={getStatusColor(delivery.status)}>{delivery.status}</Badge>
              </td>
              <td class="py-3 text-slate-400">{delivery.attempts}</td>
              <td class="py-3 text-xs text-slate-400">
                {formatDate(delivery.lastAttemptAt)}
              </td>
            </tr>
          {/each}
        </tbody>
      </Table>
    {/if}
  {/if}

  <Dialog bind:open={showCreate} onClose={() => (showCreate = false)}>
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">Add Webhook Destination</h2>
      <div class="space-y-3">
        <div>
          <label for="newUrl" class="block mb-1 text-sm text-slate-400">URL *</label>
          <Input placeholder="https://example.com/webhook" bind:value={newUrl} />
        </div>
        <div>
          <label for="newEvents" class="block mb-1 text-sm text-slate-400">Events (comma-separated) *</label>
          <Input placeholder="users.created, tasks.updated" bind:value={newEvents} />
        </div>
        <div>
          <label for="newSecret" class="block mb-1 text-sm text-slate-400">Secret (for HMAC signing)</label>
          <Input type="password" placeholder="Optional secret" bind:value={newSecret} />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="newRetryAttempts" class="block mb-1 text-sm text-slate-400">Retry Attempts</label>
            <Input type="text" bind:value={newRetryAttempts} />
          </div>
          <div>
            <label for="newRetryDelay" class="block mb-1 text-sm text-slate-400">Retry Delay (ms)</label>
            <Input type="text" bind:value={newRetryDelay} />
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <Button variant="ghost" onclick={() => (showCreate = false)}>Cancel</Button>
        <Button onclick={createWebhook}>Add Webhook</Button>
      </div>
    </div>
  </Dialog>
</div>
