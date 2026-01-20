<script lang="ts">
  import { createEventDispatcher } from "svelte"
  import { cn } from "$lib/utils"
  import type { MultiSelectItem, MultiSelectChange } from "./types"

  export let items: MultiSelectItem[] = []
  export let selected: MultiSelectItem[] = []
  export let placeholder = "Select..."
  export let disabled = false
  export let invalid = false
  export let className: string | undefined = undefined

  const dispatch = createEventDispatcher<{ change: MultiSelectChange }>()

  let open = false
  let search = ""
  let container: HTMLDivElement | null = null

  $: selectedValues = new Set(selected?.map((item) => item.value) ?? [])
  $: filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(search.trim().toLowerCase())
  )

  const toggleItem = (item: MultiSelectItem) => {
    if (disabled) return
    const next = selectedValues.has(item.value)
      ? selected.filter((entry) => entry.value !== item.value)
      : [...selected, item]
    dispatch("change", { selected: next })
  }

  const removeItem = (item: MultiSelectItem) => {
    if (disabled) return
    const next = selected.filter((entry) => entry.value !== item.value)
    dispatch("change", { selected: next })
  }

  const close = () => {
    open = false
    search = ""
  }

  const handleOutsideClick = (event: MouseEvent) => {
    if (!container) return
    if (!container.contains(event.target as Node)) {
      close()
    }
  }
</script>

<svelte:window onclick={handleOutsideClick} />

<div
  bind:this={container}
  class={cn("relative w-full", className)}
  data-invalid={invalid ? "true" : undefined}
>
  <div
    role="button"
    tabindex={disabled ? -1 : 0}
    aria-expanded={open}
    aria-disabled={disabled}
    class={cn(
      "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow]",
      "border-input placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50",
      "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
      "data-[invalid=true]:border-destructive data-[invalid=true]:ring-destructive/20",
      disabled ? "pointer-events-none cursor-not-allowed opacity-50" : "",
      open ? "ring-1 ring-ring/30" : "",
      selected.length ? "text-foreground" : "text-muted-foreground"
    )}
    data-invalid={invalid ? "true" : undefined}
    onclick={() => (open = !open)}
    onkeydown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        open = !open
      }
      if (event.key === "Escape") {
        event.preventDefault()
        close()
      }
    }}
  >
    {#if selected.length === 0}
      <span>{placeholder}</span>
    {:else}
      {#each selected as item (item.value)}
        <span class="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-foreground">
          {item.label}
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground"
            onclick={(event) => {
              event.stopPropagation()
              removeItem(item)
            }}
            aria-label={`Remove ${item.label}`}
          >
            ×
          </button>
        </span>
      {/each}
    {/if}
    <span class="ml-auto text-xs text-muted-foreground">▾</span>
  </div>

  {#if open}
    <div class="absolute z-50 mt-2 w-full rounded-md border border-input bg-popover shadow-md">
      <div class="border-b border-border px-3 py-2">
        <input
          class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          type="text"
          placeholder="Search..."
          bind:value={search}
          disabled={disabled}
        />
      </div>
      <div class="max-h-56 overflow-auto py-1">
        {#if filteredItems.length === 0}
          <div class="px-3 py-2 text-sm text-muted-foreground">No matches</div>
        {:else}
          {#each filteredItems as item (item.value)}
            <button
              type="button"
              class={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-sm",
                "hover:bg-accent hover:text-accent-foreground",
                selectedValues.has(item.value) ? "bg-accent text-accent-foreground" : "text-foreground"
              )}
              onclick={() => toggleItem(item)}
            >
              <span
                class={cn(
                  "flex h-4 w-4 items-center justify-center rounded border",
                  selectedValues.has(item.value)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background"
                )}
              >
                {#if selectedValues.has(item.value)}
                  ✓
                {/if}
              </span>
              <span>{item.label}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
