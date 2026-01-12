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
    "flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ring-offset-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:ring-offset-slate-950",
    className
  )}
/>
