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
  import type { NavItem } from "$lib/navigation"
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
  import UsersIcon from "@lucide/svelte/icons/users"
  import ShieldIcon from "@lucide/svelte/icons/shield"
  import KeyIcon from "@lucide/svelte/icons/key"
  import UserRoundIcon from "@lucide/svelte/icons/user-round"
  import LogOutIcon from "@lucide/svelte/icons/log-out"
  import MoonIcon from "@lucide/svelte/icons/moon"
  import SunIcon from "@lucide/svelte/icons/sun"
  import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "../shadcn-svelte/accordion"

  type NavMode = "nav" | "settings"

  export let navItems: NavItem[] | null = null

  type LocalNavItem = {
    label: string
    path: string
    icon?: string
    iconComponent?: typeof UsersIcon
    group?: string
  }

  const defaultNavGroups: Array<{
    id: string
    label: string
    items: LocalNavItem[]
  }> = [
    {
      id: "identity",
      label: "Identity",
      items: [
        { label: "Users", path: "/admin/users", iconComponent: UsersIcon },
        { label: "Subjects", path: "/admin/subjects", iconComponent: UserRoundIcon },
      ],
    },
    {
      id: "access",
      label: "Access",
      items: [
        { label: "Roles", path: "/admin/roles", iconComponent: ShieldIcon },
        { label: "Permissions", path: "/admin/permissions", iconComponent: KeyIcon },
      ],
    },
  ]

  const normalizeNavItems = (items: LocalNavItem[]) => {
    const grouped = new Map<string, LocalNavItem[]>()
    const ungrouped: LocalNavItem[] = []

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

  $: resolvedNavItems = (navItems ?? []) as LocalNavItem[]
  $: navGroups =
    resolvedNavItems.length > 0 ? normalizeNavItems(resolvedNavItems) : defaultNavGroups
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

  const handleGroupChange = (nextValue: string[] | string) => {
    if ($navPreferences.sidebarCollapsed || !$navPreferences.showGroupHeadings) return
    const nextValues = Array.isArray(nextValue) ? nextValue : [nextValue]
    const collapsedGroups = navGroups.reduce<Record<string, boolean>>((acc, group) => {
      acc[group.id] = !nextValues.includes(group.id)
      return acc
    }, {})
    savePreferences({
      ...$navPreferences,
      collapsedGroups,
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

    // Listen for Swup navigation events to update current path
    const handleSwupNavigation = () => {
      currentPath = window.location.pathname
    }
    document.addEventListener("swup:contentReplaced", handleSwupNavigation)
    document.addEventListener("swup:pageView", handleSwupNavigation)

    return () => {
      media.removeEventListener("change", update)
      stopThemeWatch()
      document.removeEventListener("swup:contentReplaced", handleSwupNavigation)
      document.removeEventListener("swup:pageView", handleSwupNavigation)
    }
  })

  let appliedPrefs: NavPreferences = defaultNavPreferences

  $: appliedPrefs = mode === "settings" ? draft : $navPreferences
  $: updateDocumentPrefs(appliedPrefs)
  $: variant = isMobile || appliedPrefs.sidebarCollapsed ? "quick" : "form"
  $: expandedGroups = navGroups
    .filter((group) => {
      if (appliedPrefs.sidebarCollapsed || !appliedPrefs.showGroupHeadings) return true
      return !(appliedPrefs.collapsedGroups[group.id] ?? false)
    })
    .map((group) => group.id)
  $: useCompactMobileNav = isMobile
  $: isRightDock = appliedPrefs.desktopDock === "right" && !isMobile
</script>

  <nav
    class={cn(
      "nomos-nav bg-card text-card-foreground flex min-h-0 flex-col md:h-full",
      $navPreferences.sidebarCollapsed && mode === "nav" ? "items-center" : "items-stretch"
    )}
    aria-label="Nomos admin navigation"
  >
  {#if mode === "nav"}
    {#if useCompactMobileNav}
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
                {#if item.iconComponent}
                        <svelte:component this={item.iconComponent} class="size-4" />
                      {:else}
                        <span class="size-4 text-foreground" aria-hidden="true">{@html item.icon}</span>
                      {/if}
                      <span class="sr-only">{item.label}</span>
                    </a>
                  </li>
          {/each}
          <li class="flex-1">
            <button
              type="button"
              class="flex items-center justify-center w-full px-3 py-2 transition rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Open screen settings"
              on:click={openSettings}
            >
              <SettingsIcon class="size-4" />
            </button>
          </li>
          <li class="flex-1">
            <button
              type="button"
              class="flex items-center justify-center w-full px-3 py-2 transition rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
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
              class="flex items-center justify-center px-3 py-2 transition rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
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
            $navPreferences.sidebarCollapsed && "w-full",
            isRightDock && "flex-row-reverse"
          )}
        >
          <div
            class={cn(
              "flex items-center gap-2",
              $navPreferences.sidebarCollapsed && "justify-center w-full"
            )}
          >
          <div class="flex items-center justify-center text-sm font-semibold rounded-lg size-8 bg-primary text-primary-foreground">
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
            $navPreferences.sidebarCollapsed && (isRightDock ? "mr-auto" : "ml-auto")
          )}
          aria-label="Open screen settings"
          on:click={openSettings}
        >
          <SettingsIcon class="size-4" />
        </button>
      </div>

        <div class="flex-1 px-2 py-4 overflow-y-auto">
          <Accordion
            type="multiple"
            value={expandedGroups}
            onValueChange={handleGroupChange}
            class="space-y-2"
          >
            {#each navGroups as group}
              <AccordionItem value={group.id} class="border-0">
                {#if $navPreferences.showGroupHeadings && !$navPreferences.sidebarCollapsed}
                  <AccordionTrigger
                    class="px-2 py-2 text-xs font-semibold tracking-wide uppercase text-muted-foreground hover:no-underline"
                  >
                    <span>{group.label}</span>
                  </AccordionTrigger>
                {/if}
                <AccordionContent class={$navPreferences.showGroupHeadings ? "pb-2" : "pb-0"}>
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
                          {#if item.iconComponent}
                            <svelte:component this={item.iconComponent} class="size-4" />
                          {:else}
                            <span class="size-4 text-foreground" aria-hidden="true">{@html item.icon}</span>
                          {/if}                          <span class={$navPreferences.sidebarCollapsed ? "sr-only" : "truncate"}
                            >{item.label}</span
                          >
                        </a>
                      </li>
                    {/each}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            {/each}
          </Accordion>
        </div>

      <div class="py-3 border-t border-border">
        <div
          class={cn(
            "flex items-center",
            $navPreferences.sidebarCollapsed ? "justify-center" : "justify-between",
            isRightDock && "flex-row-reverse"
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
