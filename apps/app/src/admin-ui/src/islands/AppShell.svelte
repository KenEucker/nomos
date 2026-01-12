<script lang="ts">
  import { onMount } from "svelte";
  import type { Snippet } from "../lib/utils";
  import { session, loadSession, hasRole, type SessionUser } from "../lib/session";
  import { apiPost } from "../lib/api";
  import Button from "../components/ui/button.svelte";

  type Props = { title?: string; children?: Snippet };
  let { title = "Dashboard", children }: Props = $props();

  let user = $state<SessionUser | null>(null);
  let loading = $state(true);
  let currentPath = $state("");

  const navItems = [
    { label: "Dashboard", path: "/" },
    { label: "Projects", path: "/projects" },
    { label: "Users", path: "/users", role: "admin" },
    { label: "API Keys", path: "/api-keys", role: "admin" },
    { label: "Webhooks", path: "/webhooks", role: "admin" },
    { label: "Jobs", path: "/jobs", role: "admin" },
    { label: "Audit Log", path: "/audit", role: "admin" },
    { label: "Errors", path: "/errors", role: "admin" },
    { label: "Routes", path: "/routes", role: "admin" },
    { label: "Diagnostics", path: "/diagnostics", role: "admin" },
    { label: "API Docs", path: "/docs" }
  ];

  onMount(() => {
    const unsubscribe = session.subscribe((value) => {
      user = value;
    });

     (async () => {
      try {
        currentPath = window.location.pathname;
        await loadSession();
      } catch {
        window.location.href = "/login";
      } finally {
        loading = false;
      }
    })();

    return () => unsubscribe();
  });

  const handleLogout = async () => {
    try {
      await apiPost("/api/auth/logout");
    } catch {
      // ignore
    }
    window.location.href = "/login";
  };
</script>

{#if loading}
  <div class="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">Loading...</div>
{:else}
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <div class="flex min-h-screen">
      <aside class="w-64 border-r border-slate-800 bg-slate-900/40 p-6">
        <div class="mb-8">
          <div class="text-xl font-semibold">Nomos Admin</div>
          <div class="text-sm text-slate-400">{user?.email}</div>
        </div>
        <nav class="space-y-2">
          {#each navItems as item}
            {#if !item.role || hasRole(user, item.role)}
              <a
                href={item.path}
                class={
                  "block rounded-md px-3 py-2 text-sm font-medium transition " +
                  (currentPath === item.path
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white")
                }
              >
                {item.label}
              </a>
            {/if}
          {/each}
        </nav>
      </aside>

      <main class="flex-1 p-8">
        <div class="mb-6 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold">{title}</h1>
            <p class="text-sm text-slate-400">Signed in as {user?.name}</p>
          </div>
          <Button variant="outline" onclick={handleLogout}>Log out</Button>
        </div>

        {@render children?.()}
      </main>
    </div>
  </div>
{/if}
