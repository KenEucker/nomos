<script lang="ts">
  import { onMount } from "svelte";
  import type { Snippet } from "../lib/utils";
  import { session, loadSession, hasRole, type SessionUser } from "../lib/session";
  import { apiPost } from "../lib/api";
  import Button from "../components/ui/button.svelte";
  import ThemeToggle from "../components/ui/theme-toggle.svelte";

  type Props = { title?: string; children?: Snippet };
  let { title = "Dashboard", children }: Props = $props();

  let user = $state<SessionUser | null>(null);
  let loading = $state(true);
  let currentPath = $state("");
  let sidebarCollapsed = $state(false);
  let mobileMenuOpen = $state(false);

  const navItems = [
    { label: "Dashboard", path: "/", icon: "dashboard" },
    { label: "Projects", path: "/projects", icon: "folder" },
    { label: "Users", path: "/users", role: "admin", icon: "users" },
    { label: "API Keys", path: "/api-keys", role: "admin", icon: "key" },
    { label: "Webhooks", path: "/webhooks", role: "admin", icon: "webhook" },
    { label: "Jobs", path: "/jobs", role: "admin", icon: "clock" },
    { label: "Audit Log", path: "/audit", role: "admin", icon: "scroll" },
    { label: "Errors", path: "/errors", role: "admin", icon: "alert" },
    { label: "Routes", path: "/routes", role: "admin", icon: "git-branch" },
    { label: "Diagnostics", path: "/diagnostics", role: "admin", icon: "activity" },
    { label: "API Docs", path: "/docs", icon: "book" }
  ];

  const icons: Record<string, string> = {
    dashboard: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>`,
    folder: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>`,
    users: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>`,
    key: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>`,
    webhook: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>`,
    clock: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>`,
    scroll: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>`,
    alert: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>`,
    "git-branch": `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>`,
    activity: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>`,
    book: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>`,
    menu: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>`,
    close: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>`,
    collapse: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>`,
    expand: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>`,
    logout: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>`
  };

  onMount(() => {
    const unsubscribe = session.subscribe((value) => {
      user = value;
    });

    // Load collapsed state from localStorage
    const savedCollapsed = localStorage.getItem("sidebar-collapsed");
    if (savedCollapsed !== null) {
      sidebarCollapsed = savedCollapsed === "true";
    }

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

  const toggleSidebar = () => {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem("sidebar-collapsed", String(sidebarCollapsed));
  };

  const toggleMobileMenu = () => {
    mobileMenuOpen = !mobileMenuOpen;
  };

  const closeMobileMenu = () => {
    mobileMenuOpen = false;
  };

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
  <div class="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-200">
    <div class="flex flex-col items-center gap-2">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-slate-400 border-t-slate-700 dark:border-slate-600 dark:border-t-slate-200"></div>
      <span>Loading...</span>
    </div>
  </div>
{:else}
  <div class="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <!-- Mobile header -->
    <header class="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-md p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        onclick={toggleMobileMenu}
        aria-label="Toggle menu"
      >
        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {@html mobileMenuOpen ? icons.close : icons.menu}
        </svg>
      </button>
      <div class="flex-1">
        <span class="text-lg font-semibold">Nomos</span>
      </div>
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-md p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        onclick={handleLogout}
        aria-label="Log out"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {@html icons.logout}
        </svg>
      </button>
    </header>

    <!-- Mobile menu overlay -->
    {#if mobileMenuOpen}
      <div
        class="fixed inset-0 z-40 bg-black/60 lg:hidden"
        onclick={closeMobileMenu}
        onkeydown={(e) => e.key === "Escape" && closeMobileMenu()}
        role="button"
        tabindex="0"
        aria-label="Close menu"
      ></div>
    {/if}

    <!-- Mobile sidebar -->
    <aside
      class={
        "fixed inset-y-0 left-0 z-50 w-64 transform border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out dark:border-slate-800 dark:bg-slate-900 lg:hidden " +
        (mobileMenuOpen ? "translate-x-0" : "-translate-x-full")
      }
    >
      <div class="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
        <span class="text-lg font-semibold">Nomos Admin</span>
        <button
          type="button"
          class="rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          onclick={closeMobileMenu}
          aria-label="Close menu"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {@html icons.close}
          </svg>
        </button>
      </div>
      <div class="flex h-[calc(100%-3.5rem)] flex-col p-4">
        <div class="mb-4 text-sm text-slate-500 dark:text-slate-400">{user?.email}</div>
        <nav class="flex-1 space-y-1">
          {#each navItems as item}
            {#if !item.role || hasRole(user, item.role)}
              <a
                href={item.path}
                onclick={closeMobileMenu}
                class={
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition " +
                  (currentPath === item.path
                    ? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white")
                }
              >
                <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {@html icons[item.icon]}
                </svg>
                <span>{item.label}</span>
              </a>
            {/if}
          {/each}
        </nav>
        <div class="border-t border-slate-200 pt-4 dark:border-slate-800">
          <ThemeToggle collapsed={false} />
        </div>
      </div>
    </aside>

    <div class="flex min-h-screen">
      <!-- Desktop sidebar -->
      <aside
        class={
          "hidden border-r border-slate-200 bg-slate-50/40 transition-all duration-200 dark:border-slate-800 dark:bg-slate-900/40 lg:block " +
          (sidebarCollapsed ? "w-16" : "w-64")
        }
      >
        <div class="sticky top-0 flex h-full flex-col">
          <!-- Logo/Brand -->
          <div class={
            "flex h-14 items-center border-b border-slate-200 dark:border-slate-800 " +
            (sidebarCollapsed ? "justify-center px-2" : "px-4")
          }>
            {#if sidebarCollapsed}
              <span class="text-xl font-bold text-slate-900 dark:text-slate-100">N</span>
            {:else}
              <span class="text-lg font-semibold">Nomos Admin</span>
            {/if}
          </div>

          <!-- User info -->
          {#if !sidebarCollapsed}
            <div class="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div class="truncate text-sm text-slate-500 dark:text-slate-400">{user?.email}</div>
            </div>
          {/if}

          <!-- Navigation -->
          <nav class="flex-1 space-y-1 p-2">
            {#each navItems as item}
              {#if !item.role || hasRole(user, item.role)}
                <a
                  href={item.path}
                  class={
                    "group flex items-center rounded-md text-sm font-medium transition " +
                    (sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5") + " " +
                    (currentPath === item.path
                      ? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white"
                      : "text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white")
                  }
                  title={sidebarCollapsed ? item.label : ""}
                >
                  <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {@html icons[item.icon]}
                  </svg>
                  {#if !sidebarCollapsed}
                    <span>{item.label}</span>
                  {/if}
                </a>
              {/if}
            {/each}
          </nav>

          <!-- Theme toggle, Collapse toggle & Logout -->
          <div class="border-t border-slate-200 p-2 dark:border-slate-800">
            <ThemeToggle collapsed={sidebarCollapsed} />
            <button
              type="button"
              onclick={toggleSidebar}
              class={
                "flex w-full items-center rounded-md text-sm font-medium text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white " +
                (sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5")
              }
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {@html sidebarCollapsed ? icons.expand : icons.collapse}
              </svg>
              {#if !sidebarCollapsed}
                <span>Collapse</span>
              {/if}
            </button>
            <button
              type="button"
              onclick={handleLogout}
              class={
                "flex w-full items-center rounded-md text-sm font-medium text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white " +
                (sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5")
              }
              title={sidebarCollapsed ? "Log out" : ""}
            >
              <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {@html icons.logout}
              </svg>
              {#if !sidebarCollapsed}
                <span>Log out</span>
              {/if}
            </button>
          </div>
        </div>
      </aside>

      <!-- Main content -->
      <main class="flex-1 overflow-x-hidden">
        <div class="p-4 sm:p-6 lg:p-8">
          <!-- Page header -->
          <div class="mb-6">
            <h1 class="text-xl font-semibold sm:text-2xl">{title}</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400">Signed in as {user?.name}</p>
          </div>

          <!-- Page content -->
          <div class="min-w-0">
            {@render children?.()}
          </div>
        </div>
      </main>
    </div>
  </div>
{/if}
