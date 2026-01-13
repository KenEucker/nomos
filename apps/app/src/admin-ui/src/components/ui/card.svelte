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

<div class={cn("rounded-lg border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100", className)}>
  <div class="p-4">
    {#if header}
      <div class="mb-3">
        {@render header()}
      </div>
    {/if}

    {@render children?.()}
  </div>

  {#if footer}
    <div class="border-t border-slate-200 p-4 dark:border-slate-800">
      {@render footer()}
    </div>
  {/if}
</div>
