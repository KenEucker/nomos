<script lang="ts">
  import { cn } from "../../lib/utils";
  import type { Snippet } from "../../lib/utils";

  type Props = {
    className?: string;
    header?: Snippet;
    footer?: Snippet;
    children?: Snippet;
  };

  let { className = "", header, footer, children }: Props = $props();
</script>

<div class={cn("rounded-lg border border-slate-800 bg-slate-950 text-slate-100 shadow-sm", className)}>
  <div class="p-4">
    {#if header}
      <div class="mb-3">
        {@render header()}
      </div>
    {/if}

    {@render children?.()}
  </div>

  {#if footer}
    <div class="border-t border-slate-800 p-4">
      {@render footer()}
    </div>
  {/if}
</div>
