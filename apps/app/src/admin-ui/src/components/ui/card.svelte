<script lang="ts">
  import { cn } from "../../lib/utils";

  let { className = "" } = $props<{ className?: string }>();
  const slots = $slots();
</script>

<div class={cn("rounded-lg border border-slate-800 bg-slate-950 text-slate-100 shadow-sm", className)}>
  <div class="p-4">
    {#if slots.header}
      <div class="mb-3">
        <slot name="header" />
      </div>
    {/if}
    <slot />
  </div>
  {#if slots.footer}
    <div class="border-t border-slate-800 p-4">
      <slot name="footer" />
    </div>
  {/if}
</div>
