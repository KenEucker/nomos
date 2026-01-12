<script lang="ts">
  import { onMount } from "svelte";
  import { session, loadSession, hasRole, type SessionUser } from "../lib/session";
  import { apiPost } from "../lib/api";
  import Button from "../components/ui/button.svelte";

  export let title = "Dashboard";
  let user: SessionUser | null = null;
  let loading = true;
  let currentPath = "";

  const unsubscribe = session.subscribe((value) => {
    user = value;
  });

  onMount(async () => {
    try {
      currentPath = window.location.pathname;
      await loadSession();
    } catch {
      window.location.href = "/login";
    } finally {
      loading = false;
    }
    return () => unsubscribe();
  });

  const navItems = [
    { label: "Dashboard", path: "/" },
    { label: "Projects", path: "/projects" },
    { label: "Users", path: "/users", role: "admin" }
  ];

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
          <Button variant="outline" on:click={handleLogout}>Log out</Button>
        </div>
        <slot />
      </main>
    </div>
  </div>
{/if}
