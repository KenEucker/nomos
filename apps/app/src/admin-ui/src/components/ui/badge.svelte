<script lang="ts">
  import { cn } from "../../lib/utils";
  import type { Snippet } from "../../lib/utils";

  let { variant = "default", className = "", children } = $props<{
    variant?: "default" | "secondary" | "success";
    className?: string;
    children?: Snippet;
  }>();
</script>

<span
  class={cn(
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
    {
      "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100": variant === "default",
      "bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-200": variant === "secondary",
      "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200": variant === "success"
    },
    className
  )}
  >
  {@render children?.()}
</span>
