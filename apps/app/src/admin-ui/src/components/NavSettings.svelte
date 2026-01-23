<script lang="ts">
  import { onMount } from "svelte"
  import { Button, buttonVariants } from "$ui/button"
  import { Switch } from "$ui/switch"
  import type { NavPreferences } from "$lib/navPreferences"
  import { getEffectiveTheme, type ThemePreference } from "$lib/theme"
  import { cn } from "$lib/utils.js"
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left"
  import CheckIcon from "@lucide/svelte/icons/check"
  import ChartBarDecreasing from "@lucide/svelte/icons/chart-bar-decreasing"
  import PanelLeftIcon from "@lucide/svelte/icons/panel-left"
  import PanelRightIcon from "@lucide/svelte/icons/panel-right"
  import BookUp from "@lucide/svelte/icons/book-up"
  import BookDown from "@lucide/svelte/icons/book-down"
  import Rows3Icon from "@lucide/svelte/icons/rows-3"
  import HeadingIcon from "@lucide/svelte/icons/heading-1"
  import MessageCircleIcon from "@lucide/svelte/icons/message-circle"
  import MonitorIcon from "@lucide/svelte/icons/monitor"
  import SmartphoneIcon from "@lucide/svelte/icons/smartphone"
  import SparklesIcon from "@lucide/svelte/icons/sparkles"
  import SunIcon from "@lucide/svelte/icons/sun"
  import MoonIcon from "@lucide/svelte/icons/moon"

  export let variant: "form" | "quick"
  export let saved: NavPreferences
  export let draft: NavPreferences
  export let savedTheme: ThemePreference
  export let draftTheme: ThemePreference
  export let onChange: (draft: NavPreferences) => void
  export let onThemeChange: (draft: ThemePreference) => void
  export let onSave: () => void
  export let onBack: () => void

  type BooleanKey =
    | "sidebarCollapsed"
    | "denseMode"
    | "showGroupHeadings"
    | "enableTooltips"
    | "reduceMotion"

  type ToggleConfig = {
    key: BooleanKey
    label: string
    description: string
    icon: typeof Rows3Icon
  }

  // Settings that apply to both desktop and mobile
  const sharedToggles: ToggleConfig[] = [
    {
      key: "reduceMotion",
      label: "Reduce motion",
      description: "Disable menu animations.",
      icon: SparklesIcon,
    },
  ]

  // Settings that only apply to desktop
  const desktopToggles: ToggleConfig[] = [
    {
      key: "sidebarCollapsed",
      label: "Icon-only sidebar",
      description: "Collapse the menu to icons only.",
      icon: ChartBarDecreasing,
    },
    {
      key: "denseMode",
      label: "Dense spacing",
      description: "Tighter spacing for menu items.",
      icon: Rows3Icon,
    },
    {
      key: "showGroupHeadings",
      label: "Group headings",
      description: "Show labels for navigation groups.",
      icon: HeadingIcon,
    },
    {
      key: "enableTooltips",
      label: "Icon tooltips",
      description: "Show tooltips in icon-only mode.",
      icon: MessageCircleIcon,
    },
  ]

  const updateDraft = (next: Partial<NavPreferences>) => {
    onChange({ ...draft, ...next })
  }

  const toggleValue = (key: BooleanKey) => {
    updateDraft({ [key]: !draft[key] })
  }

  const toggleDesktopDock = () => {
    updateDraft({
      desktopDock: draft.desktopDock === "left" ? "right" : "left",
    })
  }

  const toggleMobileDock = () => {
    updateDraft({
      mobileDock: draft.mobileDock === "top" ? "bottom" : "top",
    })
  }

  const toggleTheme = () => {
    const next = getEffectiveTheme(draftTheme) === "dark" ? "light" : "dark"
    onThemeChange(next)
  }

  let isDirty = false
  let themeIsDark = false
  let isMobile = false

  $: isDirty = JSON.stringify(saved) !== JSON.stringify(draft) || savedTheme !== draftTheme
  $: themeIsDark = getEffectiveTheme(draftTheme) === "dark"

  onMount(() => {
    const media = window.matchMedia("(max-width: 768px)")
    const update = () => {
      isMobile = media.matches
    }
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  })
</script>

<div class="flex flex-col h-full">
  {#if variant === "form"}
    <div class="flex items-center justify-between px-3 py-2 border-b border-border">
      <button
        type="button"
        class={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        on:click={onBack}
        aria-label="Back to navigation"
      >
        <ArrowLeftIcon class="size-4" />
        <span class="text-sm">Back</span>
      </button>
      <div class="text-sm font-semibold">Screen Settings</div>
      <button
        type="button"
        class={cn(buttonVariants({ variant: "default", size: "sm" }))}
        on:click={onSave}
        aria-label="Save screen settings"
        title={isDirty ? "Save changes" : "No changes to save"}
      >
        <CheckIcon class="size-4" />
        <span class="text-sm">Save</span>
      </button>
    </div>
  {:else if !isMobile}
    <div class="flex flex-col items-center gap-2 px-2 py-2 border-b border-border">
      <button
        type="button"
        class={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "w-full")}
        on:click={onBack}
        aria-label="Back to navigation"
        title="Back"
      >
        <ArrowLeftIcon class="size-4" />
      </button>
      <button
        type="button"
        class={cn(buttonVariants({ variant: "default", size: "icon-sm" }), "w-full")}
        on:click={onSave}
        aria-label="Save screen settings"
        title={isDirty ? "Save changes" : "No changes to save"}
      >
        <CheckIcon class="size-4" />
      </button>
    </div>
  {/if}

  {#if variant === "form"}
    <div class="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
      <!-- Shared settings (both desktop and mobile) -->
      <div class="space-y-3">
        <div class="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          General
        </div>
        <div class="flex items-center justify-between gap-3 px-3 py-2 border rounded-lg border-border">
          <div class="flex items-start gap-3">
            {#if themeIsDark}
              <MoonIcon class="mt-0.5 size-4 text-muted-foreground" />
            {:else}
              <SunIcon class="mt-0.5 size-4 text-muted-foreground" />
            {/if}
            <div>
              <div class="text-sm font-medium">Dark mode</div>
              <div class="text-xs text-muted-foreground">Toggle light or dark mode.</div>
            </div>
          </div>
          <Switch
            checked={themeIsDark}
            aria-label="Dark mode"
            onCheckedChange={(value) => onThemeChange(value ? "dark" : "light")}
          />
        </div>
        {#each sharedToggles as toggle}
          <div class="flex items-center justify-between gap-3 px-3 py-2 border rounded-lg border-border">
            <div class="flex items-start gap-3">
              <svelte:component this={toggle.icon} class="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <div class="text-sm font-medium">{toggle.label}</div>
                <div class="text-xs text-muted-foreground">{toggle.description}</div>
              </div>
            </div>
            <Switch
              checked={draft[toggle.key]}
              aria-label={toggle.label}
              onCheckedChange={(value) => updateDraft({ [toggle.key]: value })}
            />
          </div>
        {/each}
      </div>

      <!-- Desktop-only settings -->
      {#if !isMobile}
        <div class="space-y-3">
          <div class="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
            Desktop
          </div>
          <div class="flex items-center justify-between gap-3 px-3 py-2 border rounded-lg border-border">
            <div class="flex items-center gap-2">
              <MonitorIcon class="size-4 text-muted-foreground" />
              <span class="text-sm">Sidebar position</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class={cn(
                  buttonVariants({
                    variant: draft.desktopDock === "left" ? "secondary" : "outline",
                    size: "icon-sm",
                  })
                )}
                aria-label="Dock sidebar left"
                aria-pressed={draft.desktopDock === "left"}
                on:click={() => updateDraft({ desktopDock: "left" })}
              >
                <PanelLeftIcon class="size-4" />
              </button>
              <button
                type="button"
                class={cn(
                  buttonVariants({
                    variant: draft.desktopDock === "right" ? "secondary" : "outline",
                    size: "icon-sm",
                  })
                )}
                aria-label="Dock sidebar right"
                aria-pressed={draft.desktopDock === "right"}
                on:click={() => updateDraft({ desktopDock: "right" })}
              >
                <PanelRightIcon class="size-4" />
              </button>
            </div>
          </div>
          {#each desktopToggles as toggle}
            <div class="flex items-center justify-between gap-3 px-3 py-2 border rounded-lg border-border">
              <div class="flex items-start gap-3">
                <svelte:component this={toggle.icon} class="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <div class="text-sm font-medium">{toggle.label}</div>
                  <div class="text-xs text-muted-foreground">{toggle.description}</div>
                </div>
              </div>
              <Switch
                checked={draft[toggle.key]}
                aria-label={toggle.label}
                onCheckedChange={(value) => updateDraft({ [toggle.key]: value })}
              />
            </div>
          {/each}
        </div>
      {/if}

      <!-- Mobile-only settings -->
      {#if isMobile}
        <div class="space-y-3">
          <div class="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
            Mobile
          </div>
          <div class="flex items-center justify-between gap-3 px-3 py-2 border rounded-lg border-border">
            <div class="flex items-center gap-2">
              <SmartphoneIcon class="size-4 text-muted-foreground" />
              <span class="text-sm">Navigation position</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class={cn(
                  buttonVariants({
                    variant: draft.mobileDock === "top" ? "secondary" : "outline",
                    size: "icon-sm",
                  })
                )}
                aria-label="Dock menu to top"
                aria-pressed={draft.mobileDock === "top"}
                on:click={() => updateDraft({ mobileDock: "top" })}
              >
                <BookDown class="size-4" />
              </button>
              <button
                type="button"
                class={cn(
                  buttonVariants({
                    variant: draft.mobileDock === "bottom" ? "secondary" : "outline",
                    size: "icon-sm",
                  })
                )}
                aria-label="Dock menu to bottom"
                aria-pressed={draft.mobileDock === "bottom"}
                on:click={() => updateDraft({ mobileDock: "bottom" })}
              >
                <BookUp class="size-4" />
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    {#if isMobile}
      <!-- Mobile quick settings: shared + mobile-only -->
      <div class="flex-1 overflow-x-auto">
        <div class="flex items-center gap-2 px-2 py-2 min-w-max">
          <button
            type="button"
            class="flex items-center justify-center rounded-md bg-primary text-primary-foreground p-3 text-sm font-medium flex-shrink-0 hover:bg-primary/90 transition-colors"
            on:click={onBack}
            aria-label="Back to navigation"
            title="Back"
          >
            <ArrowLeftIcon class="size-5" />
          </button>
          <button
            type="button"
            class="flex items-center justify-center rounded-md bg-primary text-primary-foreground p-3 text-sm font-medium flex-shrink-0 hover:bg-primary/90 transition-colors"
            on:click={onSave}
            aria-label="Save screen settings"
            title={isDirty ? "Save changes" : "No changes to save"}
          >
            <CheckIcon class="size-5" />
          </button>
          <div class="h-8 w-px bg-border flex-shrink-0"></div>
          <!-- Shared: Theme toggle -->
          <button
            type="button"
            class={
              themeIsDark
                ? "flex items-center justify-center rounded-md border border-border bg-accent p-3 text-sm font-medium flex-shrink-0"
                : "flex items-center justify-center rounded-md border border-border p-3 text-sm flex-shrink-0"
            }
            aria-label="Toggle dark mode"
            aria-pressed={themeIsDark}
            on:click={toggleTheme}
            title="Dark mode"
          >
            {#if themeIsDark}
              <MoonIcon class="size-5" />
            {:else}
              <SunIcon class="size-5" />
            {/if}
          </button>
          <!-- Shared toggles -->
          {#each sharedToggles as toggle}
            <button
              type="button"
              class={
                draft[toggle.key]
                  ? "flex items-center justify-center rounded-md border border-border bg-accent p-3 text-sm font-medium flex-shrink-0"
                  : "flex items-center justify-center rounded-md border border-border p-3 text-sm flex-shrink-0"
              }
              aria-label={toggle.label}
              aria-pressed={draft[toggle.key]}
              on:click={() => toggleValue(toggle.key)}
              title={toggle.label}
            >
              <svelte:component this={toggle.icon} class="size-5" />
            </button>
          {/each}
          <div class="h-8 w-px bg-border flex-shrink-0"></div>
          <!-- Mobile-only: Navigation position -->
          <button
            type="button"
            class={
              draft.mobileDock === "top"
                ? "flex items-center justify-center rounded-md border border-border bg-accent p-3 text-sm font-medium flex-shrink-0"
                : "flex items-center justify-center rounded-md border border-border p-3 text-sm flex-shrink-0"
            }
            aria-label={`Navigation ${draft.mobileDock === "top" ? "top" : "bottom"}`}
            aria-pressed={draft.mobileDock === "top"}
            on:click={toggleMobileDock}
            title="Navigation position"
          >
            {#if draft.mobileDock === "top"}
              <BookDown class="size-5" />
            {:else}
              <BookUp class="size-5" />
            {/if}
          </button>
        </div>
      </div>
    {:else}
      <!-- Desktop quick settings (collapsed sidebar): shared + desktop-only -->
      <div class="flex-1 px-2 py-4 overflow-y-auto">
        <div class="flex flex-col items-center gap-2">
          <!-- Shared: Theme toggle -->
          <button
            type="button"
            class={
              themeIsDark
                ? "flex items-center justify-center rounded-md border border-border bg-accent p-3 text-sm font-medium w-full"
                : "flex items-center justify-center rounded-md border border-border p-3 text-sm w-full"
            }
            aria-label="Toggle dark mode"
            aria-pressed={themeIsDark}
            on:click={toggleTheme}
            title="Dark mode"
          >
            {#if themeIsDark}
              <MoonIcon class="size-5" />
            {:else}
              <SunIcon class="size-5" />
            {/if}
          </button>
          <!-- Shared toggles -->
          {#each sharedToggles as toggle}
            <button
              type="button"
              class={
                draft[toggle.key]
                  ? "flex items-center justify-center rounded-md border border-border bg-accent p-3 text-sm font-medium w-full"
                  : "flex items-center justify-center rounded-md border border-border p-3 text-sm w-full"
              }
              aria-label={toggle.label}
              aria-pressed={draft[toggle.key]}
              on:click={() => toggleValue(toggle.key)}
              title={toggle.label}
            >
              <svelte:component this={toggle.icon} class="size-5" />
            </button>
          {/each}
          <div class="h-px w-full bg-border my-1"></div>
          <!-- Desktop-only: Sidebar position -->
          <button
            type="button"
            class={
              draft.desktopDock === "left"
                ? "flex items-center justify-center rounded-md border border-border bg-accent p-3 text-sm font-medium w-full"
                : "flex items-center justify-center rounded-md border border-border p-3 text-sm w-full"
            }
            aria-label={`Sidebar ${draft.desktopDock === "left" ? "left" : "right"}`}
            aria-pressed={draft.desktopDock === "left"}
            on:click={toggleDesktopDock}
            title="Sidebar position"
          >
            {#if draft.desktopDock === "left"}
              <PanelLeftIcon class="size-5" />
            {:else}
              <PanelRightIcon class="size-5" />
            {/if}
          </button>
          <!-- Desktop toggles -->
          {#each desktopToggles as toggle}
            <button
              type="button"
              class={
                draft[toggle.key]
                  ? "flex items-center justify-center rounded-md border border-border bg-accent p-3 text-sm font-medium w-full"
                  : "flex items-center justify-center rounded-md border border-border p-3 text-sm w-full"
              }
              aria-label={toggle.label}
              aria-pressed={draft[toggle.key]}
              on:click={() => toggleValue(toggle.key)}
              title={toggle.label}
            >
              <svelte:component this={toggle.icon} class="size-5" />
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>
