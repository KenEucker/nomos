<script lang="ts">
  import { onMount } from "svelte"
  import { Button } from "$ui/button"
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

  const buttonVariants = Button.variants
  const toggles: Array<{
    key: BooleanKey
    label: string
    description: string
    icon: typeof Rows3Icon
  }> = [
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
    {
      key: "reduceMotion",
      label: "Reduce motion",
      description: "Disable menu animations.",
      icon: SparklesIcon,
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

  {#if variant === "form"}
    <div class="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
      <div class="space-y-3">
        <div class="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          Appearance
        </div>
        <div class="flex items-center justify-between gap-3 px-3 py-2 border rounded-lg border-border">
          <div class="flex items-start gap-3">
            {#if themeIsDark}
              <MoonIcon class="mt-0.5 size-4 text-muted-foreground" />
            {:else}
              <SunIcon class="mt-0.5 size-4 text-muted-foreground" />
            {/if}
            <div>
              <div class="text-sm font-medium">Theme</div>
              <div class="text-xs text-muted-foreground">Toggle light or dark mode.</div>
            </div>
          </div>
          <Switch
            checked={themeIsDark}
            aria-label="Theme"
            onCheckedChange={(value) => onThemeChange(value ? "dark" : "light")}
          />
        </div>
      </div>

      <div class="space-y-3">
        <div class="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          Docking
        </div>
        {#if !isMobile}
          <div class="flex items-center justify-between gap-3 px-3 py-2 border rounded-lg border-border">
            <div class="flex items-center gap-2">
              <MonitorIcon class="size-4 text-muted-foreground" />
              <span class="text-sm">Desktop dock</span>
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
        {:else}
          <div class="flex items-center justify-between gap-3 px-3 py-2 border rounded-lg border-border">
            <div class="flex items-center gap-2">
              <SmartphoneIcon class="size-4 text-muted-foreground" />
              <span class="text-sm">Mobile dock</span>
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
        {/if}
      </div>

      <div class="space-y-3">
        <div class="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          Menu behavior
        </div>
        {#each toggles as toggle}
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
    </div>
  {:else}
    <div class="flex-1 px-3 py-4 overflow-y-auto">
      <div class="flex flex-wrap items-center justify-between gap-2 sm:grid sm:grid-cols-2 sm:gap-3">
        {#if !isMobile}
          <button
            type="button"
            class={
              draft.desktopDock === "left"
                ? "flex flex-1 flex-col items-center gap-2 rounded-xl border border-border bg-accent px-3 py-4 text-sm font-medium sm:flex-none"
                : "flex flex-1 flex-col items-center gap-2 rounded-xl border border-border px-3 py-4 text-sm sm:flex-none"
            }
            aria-label={`Desktop dock ${draft.desktopDock === "left" ? "left" : "right"}`}
            aria-pressed={draft.desktopDock === "left"}
            on:click={toggleDesktopDock}
          >
            {#if draft.desktopDock === "left"}
              <PanelLeftIcon class="size-5" />
            {:else}
              <PanelRightIcon class="size-5" />
            {/if}
            <span class="hidden text-[10px] text-muted-foreground sm:block">Desktop dock</span>
          </button>
        {:else}
          <button
            type="button"
            class={
              draft.mobileDock === "top"
                ? "flex flex-1 flex-col items-center gap-2 rounded-xl border border-border bg-accent px-3 py-4 text-sm font-medium sm:flex-none"
                : "flex flex-1 flex-col items-center gap-2 rounded-xl border border-border px-3 py-4 text-sm sm:flex-none"
            }
            aria-label={`Mobile dock ${draft.mobileDock === "top" ? "top" : "bottom"}`}
            aria-pressed={draft.mobileDock === "top"}
            on:click={toggleMobileDock}
          >
            {#if draft.mobileDock === "top"}
              <BookDown class="size-5" />
            {:else}
              <BookUp class="size-5" />
            {/if}
            <span class="hidden text-[10px] text-muted-foreground sm:block">Mobile dock</span>
          </button>
        {/if}
        <button
          type="button"
          class={
            themeIsDark
              ? "flex flex-1 flex-col items-center gap-2 rounded-xl border border-border bg-accent px-3 py-4 text-sm font-medium sm:flex-none"
              : "flex flex-1 flex-col items-center gap-2 rounded-xl border border-border px-3 py-4 text-sm sm:flex-none"
          }
          aria-label="Toggle theme"
          aria-pressed={themeIsDark}
          on:click={toggleTheme}
        >
          {#if themeIsDark}
            <MoonIcon class="size-5" />
          {:else}
            <SunIcon class="size-5" />
          {/if}
          <span class="hidden text-[10px] text-muted-foreground sm:block">Theme</span>
        </button>
        {#each toggles as toggle}
          <button
            type="button"
            class={
              draft[toggle.key]
                ? "flex flex-1 flex-col items-center gap-2 rounded-xl border border-border bg-accent px-3 py-4 text-sm font-medium sm:flex-none"
                : "flex flex-1 flex-col items-center gap-2 rounded-xl border border-border px-3 py-4 text-sm sm:flex-none"
            }
            aria-label={toggle.label}
            aria-pressed={draft[toggle.key]}
            on:click={() => toggleValue(toggle.key)}
          >
            <svelte:component this={toggle.icon} class="size-5" />
            <span class="hidden text-[10px] text-muted-foreground sm:block">{toggle.label}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
