<script lang="ts">
  import { cn } from "../../lib/utils";
  export let tabs: Array<{ id: string; label: string }> = [];
  export let active = "";
  export let className = "";
  export let onChange: ((id: string) => void) | undefined;
</script>

<div class={cn("space-y-4", className)}>
  <div class="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-1">
    {#each tabs as tab}
      <button
        class={cn(
          "rounded-md px-3 py-1 text-sm transition",
          active === tab.id
            ? "bg-slate-100 text-slate-900"
            : "text-slate-300 hover:text-slate-100"
        )}
        on:click={() => onChange?.(tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>
  <slot {active} />
</div>
