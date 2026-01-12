<script lang="ts">
  import { cn } from "../../lib/utils";
  import type { HTMLInputAttributes } from "svelte/elements";

  type Props = HTMLInputAttributes & {
    className?: string;
    value?: string;
  };

  let {
    className = "",
    value = $bindable<string>(""),
    ...restProps
  }: Props = $props();
</script>

<input
  {...restProps}
  bind:value
  class={cn(
    "flex h-9 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-1 text-sm text-slate-100 shadow-sm transition-colors placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ring-offset-slate-950",
    className
  )}
/>
