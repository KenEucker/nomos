<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "./AppShell.svelte";
  import Button from "../components/ui/button.svelte";
  import Card from "../components/ui/card.svelte";
  import { session, type SessionUser } from "../lib/session";

  let user = $state<SessionUser | null>(null);
  let loading = $state(true);
  let docsAccessible = $state(false);
  let error = $state<string | null>(null);

  const unsubscribe = session.subscribe((value) => (user = value));

  const checkDocsAccess = async () => {
    loading = true;
    try {
      const response = await fetch("/api/docs", {
        method: "HEAD",
        credentials: "include"
      });
      docsAccessible = response.ok;
      if (!response.ok && response.status === 403) {
        error = "API documentation is not accessible. It may be restricted in production.";
      }
    } catch {
      error = "Failed to check documentation access.";
    }
    loading = false;
  };

  const openDocs = () => {
    window.open("/docs", "_blank");
  };

  const openOpenApi = () => {
    window.open("/openapi.json", "_blank");
  };

  onMount(() => {
    const check = setInterval(async () => {
      if (!user) return;
      clearInterval(check);
      await checkDocsAccess();
    }, 100);
    return () => {
      unsubscribe();
      clearInterval(check);
    };
  });
</script>

<AppShell title="API Documentation">
  {#if loading}
    <div class="text-slate-400">Checking documentation access...</div>
  {:else if error}
    <Card>
      <div class="py-8 text-center">
        <div class="mb-4 text-yellow-400">{error}</div>
        <p class="mb-4 text-sm text-slate-400">
          In development mode, documentation is publicly accessible.
          In production, set <code class="px-1 rounded bg-slate-800">SWAGGER_PUBLIC=true</code> to enable public access.
        </p>
        <Button variant="outline" onclick={checkDocsAccess}>Retry</Button>
      </div>
    </Card>
  {:else if docsAccessible}
    <div class="space-y-6">
      <Card>
        <h3 class="mb-4 text-lg font-semibold text-slate-100">Swagger UI</h3>
        <p class="mb-4 text-sm text-slate-400">
          Interactive API documentation with try-it-out functionality.
        </p>
        <div class="flex gap-2">
          <Button onclick={openDocs}>Open Swagger UI</Button>
          <Button variant="outline" onclick={openOpenApi}>View OpenAPI JSON</Button>
        </div>
      </Card>

      <Card>
        <h3 class="mb-4 text-lg font-semibold text-slate-100">Embedded Documentation</h3>
        <div class="overflow-hidden border rounded-lg bg-slate-900 border-slate-700">
          <iframe
            src="/api/docs"
            class="w-full h-[600px] border-0"
            title="API Documentation"
          ></iframe>
        </div>
      </Card>

      <Card>
        <h3 class="mb-4 text-lg font-semibold text-slate-100">Quick Links</h3>
        <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
          <a
            href="/docs"
            target="_blank"
            class="block p-4 transition border rounded-lg bg-slate-900/50 border-slate-800 hover:border-slate-600"
          >
            <div class="text-sm font-medium text-slate-100">Swagger UI</div>
            <div class="text-xs text-slate-400">/docs</div>
          </a>
          <a
            href="/openapi.json"
            target="_blank"
            class="block p-4 transition border rounded-lg bg-slate-900/50 border-slate-800 hover:border-slate-600"
          >
            <div class="text-sm font-medium text-slate-100">OpenAPI Spec</div>
            <div class="text-xs text-slate-400">/openapi.json</div>
          </a>
          <a
            href="/api/docs"
            target="_blank"
            class="block p-4 transition border rounded-lg bg-slate-900/50 border-slate-800 hover:border-slate-600"
          >
            <div class="text-sm font-medium text-slate-100">API Docs</div>
            <div class="text-xs text-slate-400">/api/docs</div>
          </a>
          <a
            href="/health"
            target="_blank"
            class="block p-4 transition border rounded-lg bg-slate-900/50 border-slate-800 hover:border-slate-600"
          >
            <div class="text-sm font-medium text-slate-100">Health Check</div>
            <div class="text-xs text-slate-400">/health</div>
          </a>
        </div>
      </Card>
    </div>
  {/if}
</AppShell>
