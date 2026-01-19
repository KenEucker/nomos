<script lang="ts">
  import { onMount } from "svelte"
  import NavSettings from "./NavSettings.svelte"
  import { cn } from "$lib/utils.js"
  import {
    createDraftFromSaved,
    defaultNavPreferences,
    loadPreferences,
    navPreferences,
    savePreferences,
    type NavPreferences,
  } from "$lib/navPreferences"
  import { buildAdminNav, type NavItem } from "$lib/navigation"
  import {
    applyThemePreference,
    effectiveTheme,
    loadThemePreference,
    persistThemePreference,
    themePreference,
    watchSystemTheme,
    type ThemePreference,
  } from "$lib/theme"
  import SettingsIcon from "@lucide/svelte/icons/settings"
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down"
  import LogOutIcon from "@lucide/svelte/icons/log-out"
  import MoonIcon from "@lucide/svelte/icons/moon"
  import SunIcon from "@lucide/svelte/icons/sun"

  type NavMode = "nav" | "settings"

  export let navItems: NavItem[] | null = null

  const normalizeNavItems = (items: NavItem[]) => {
    const grouped = new Map<string, NavItem[]>()
    const ungrouped: NavItem[] = []

    items.forEach((item) => {
      if (item.group) {
        const existing = grouped.get(item.group) ?? []
        existing.push(item)
        grouped.set(item.group, existing)
      } else {
        ungrouped.push(item)
      }
    })

    const groups = Array.from(grouped.entries()).map(([label, items]) => ({
      id: label,
      label,
      items,
    }))

    if (ungrouped.length) {
      groups.unshift({ id: "general", label: "General", items: ungrouped })
    }

    return groups
  }

  $: resolvedNavItems = navItems ?? buildAdminNav({ basePath: import.meta.env.BASE_URL })
  $: navGroups = normalizeNavItems(resolvedNavItems)
  $: mobileItems = navGroups.flatMap((group) => group.items)

  let mode: NavMode = "nav"
  let draft: NavPreferences = createDraftFromSaved(defaultNavPreferences)
  let themeDraft: ThemePreference = "system"
  let savedTheme: ThemePreference = "system"
  let currentPath = ""
  let isMobile = false
  let variant: "form" | "quick" = "form"

  const updateDocumentPrefs = (prefs: NavPreferences) => {
    if (typeof document === "undefined") return
    const root = document.documentElement
    root.dataset.navDesktopDock = prefs.desktopDock
    root.dataset.navMobileDock = prefs.mobileDock
    root.dataset.navCollapsed = prefs.sidebarCollapsed ? "true" : "false"
    root.dataset.navDense = prefs.denseMode ? "true" : "false"
    root.dataset.navShowGroups = prefs.showGroupHeadings ? "true" : "false"
    root.dataset.navTooltips = prefs.enableTooltips ? "true" : "false"
    root.dataset.navReduceMotion = prefs.reduceMotion ? "true" : "false"
    root.dataset.navMode = mode
  }

  const openSettings = () => {
    draft = createDraftFromSaved($navPreferences)
    savedTheme = $themePreference
    themeDraft = savedTheme
    mode = "settings"
  }

  const handleSave = () => {
    savePreferences(draft)
    persistThemePreference(themeDraft)
    mode = "nav"
  }

  const handleBack = () => {
    draft = createDraftFromSaved($navPreferences)
    themeDraft = savedTheme
    applyThemePreference(savedTheme)
    mode = "nav"
  }

  const handleDraftChange = (next: NavPreferences) => {
    draft = next
  }

  const handleThemeDraftChange = (next: ThemePreference) => {
    themeDraft = next
    applyThemePreference(next)
  }

  const toggleTheme = () => {
    const next = $effectiveTheme === "dark" ? "light" : "dark"
    persistThemePreference(next)
  }

  const toggleGroup = (id: string) => {
    const collapsed = $navPreferences.collapsedGroups[id] ?? false
    savePreferences({
      ...$navPreferences,
      collapsedGroups: {
        ...$navPreferences.collapsedGroups,
        [id]: !collapsed,
      },
    })
  }

  onMount(() => {
    loadPreferences()
    const initialTheme = loadThemePreference()
    themeDraft = initialTheme
    currentPath = window.location.pathname
    const media = window.matchMedia("(max-width: 768px)")
    const update = () => {
      isMobile = media.matches
    }
    update()
    const stopThemeWatch = watchSystemTheme()
    media.addEventListener("change", update)
    return () => {
      media.removeEventListener("change", update)
      stopThemeWatch()
    }
  })

  let appliedPrefs: NavPreferences = defaultNavPreferences

  $: appliedPrefs = mode === "settings" ? draft : $navPreferences
  $: updateDocumentPrefs(appliedPrefs)
  $: variant = isMobile || appliedPrefs.sidebarCollapsed ? "quick" : "form"
</script>

  <nav
    class={cn(
      "nomos-nav bg-card text-card-foreground flex h-full min-h-0 flex-col",
      $navPreferences.sidebarCollapsed && mode === "nav" ? "items-center" : "items-stretch"
    )}
    aria-label="Nomos admin navigation"
  >
  {#if mode === "nav"}
    {#if isMobile}
      <div class="flex-1">
        <ul class="flex items-center justify-around gap-2 px-2 py-2">
          {#each mobileItems as item}
            <li class="flex-1">
                    <a
                      href={item.path}
                      class={cn(
                        "flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition",
                        currentPath.startsWith(item.path)
                          ? "bg-accent text-foreground"
                          : "hover:bg-accent hover:text-foreground"
                      )}
                      aria-current={currentPath.startsWith(item.path) ? "page" : undefined}
                      aria-label={item.label}
                    >
                      <span class="size-4 text-foreground" aria-hidden="true">{@html item.icon}</span>
                      <span class="sr-only">{item.label}</span>
                    </a>
                  </li>
          {/each}
          <li class="flex-1">
            <button
              type="button"
              class="flex w-full items-center justify-center rounded-md px-3 py-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Open screen settings"
              on:click={openSettings}
            >
              <SettingsIcon class="size-4" />
            </button>
          </li>
          <li class="flex-1">
            <button
              type="button"
              class="flex w-full items-center justify-center rounded-md px-3 py-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label={`Switch to ${$effectiveTheme === "dark" ? "light" : "dark"} mode`}
              aria-pressed={$effectiveTheme === "dark"}
              on:click={toggleTheme}
            >
              {#if $effectiveTheme === "dark"}
                <MoonIcon class="size-4" />
              {:else}
                <SunIcon class="size-4" />
              {/if}
            </button>
          </li>
          <li class="flex-1">
            <a
              href="/admin/logout"
              class="flex items-center justify-center rounded-md px-3 py-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Log out"
            >
              <LogOutIcon class="size-4" />
              <span class="sr-only">Log out</span>
            </a>
          </li>
        </ul>
      </div>
    {:else}
        <div
          class={cn(
            "flex items-center justify-between gap-2 border-b border-border px-3 py-3",
            $navPreferences.sidebarCollapsed && "w-full"
          )}
        >
          <div
            class={cn(
              "flex items-center gap-2",
              $navPreferences.sidebarCollapsed && "justify-center w-full"
            )}
          >
          <div class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
            N
          </div>
          <span class={cn("text-sm font-semibold", $navPreferences.sidebarCollapsed && "sr-only")}
            >Nomos Admin</span
          >
        </div>
        <button
          type="button"
          class={cn(
            "rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground",
            $navPreferences.sidebarCollapsed && "ml-auto"
          )}
          aria-label="Open screen settings"
          on:click={openSettings}
        >
          <SettingsIcon class="size-4" />
        </button>
      </div>

        <div class="flex-1 space-y-4 overflow-y-auto px-2 py-4">
          {#each navGroups as group}
            {@const collapsed =
              $navPreferences.sidebarCollapsed ? false : $navPreferences.collapsedGroups[group.id] ?? false}
          <div class="space-y-2">
            {#if $navPreferences.showGroupHeadings && !$navPreferences.sidebarCollapsed && group.label !== "General"}
              <button
                type="button"
                class="flex w-full items-center justify-between gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                aria-expanded={!collapsed}
                on:click={() => toggleGroup(group.id)}
              >
                <span>{group.label}</span>
                <ChevronDownIcon
                  class={cn("size-3 transition-transform", collapsed && "-rotate-90")}
                />
              </button>
            {/if}
            {#if !collapsed}
              <ul class="space-y-1">
                {#each group.items as item}
                  <li>
                    <a
                      href={item.path}
                      class={cn(
                        "flex items-center gap-3 rounded-md px-3 text-sm font-medium text-foreground transition",
                        $navPreferences.denseMode ? "py-1.5" : "py-2",
                        currentPath.startsWith(item.path)
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      aria-current={currentPath.startsWith(item.path) ? "page" : undefined}
                      aria-label={item.label}
                      title={
                        $navPreferences.sidebarCollapsed && $navPreferences.enableTooltips
                          ? item.label
                          : undefined
                      }
                    >
                      <span class="size-4 text-foreground" aria-hidden="true">{@html item.icon}</span>
                      <span class={$navPreferences.sidebarCollapsed ? "sr-only" : "truncate"}
                        >{item.label}</span
                      >
                    </a>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/each}
      </div>

      <div class="border-t border-border px-3 py-3">
        <div
          class={cn(
            "flex items-center gap-2",
            $navPreferences.sidebarCollapsed ? "justify-center" : "justify-between"
          )}
        >
          <a
            href="/admin/logout"
            class={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground",
              $navPreferences.sidebarCollapsed && "justify-center"
            )}
            aria-label="Log out"
          >
            <LogOutIcon class="size-4" />
            <span class={$navPreferences.sidebarCollapsed ? "sr-only" : undefined}>Log out</span>
          </a>
          <button
            type="button"
            class={cn(
              "rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground",
              $navPreferences.sidebarCollapsed && "ml-0"
            )}
            aria-label={`Switch to ${$effectiveTheme === "dark" ? "light" : "dark"} mode`}
            aria-pressed={$effectiveTheme === "dark"}
            on:click={toggleTheme}
          >
            {#if $effectiveTheme === "dark"}
              <MoonIcon class="size-4" />
            {:else}
              <SunIcon class="size-4" />
            {/if}
          </button>
        </div>
      </div>
    {/if}
  {:else}
    <NavSettings
      variant={variant}
      saved={$navPreferences}
      draft={draft}
      savedTheme={savedTheme}
      draftTheme={themeDraft}
      onChange={handleDraftChange}
      onThemeChange={handleThemeDraftChange}
      onSave={handleSave}
      onBack={handleBack}
    />
  {/if}
</nav>
