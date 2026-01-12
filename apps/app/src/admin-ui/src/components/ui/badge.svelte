<script lang="ts">
  import { cn } from "../../lib/utils";

  let { variant = "default", className = "" } = $props<{
    variant?: "default" | "secondary" | "success";
    className?: string;
  }>();
</script>

<span
  class={cn(
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
    {
      "bg-slate-800 text-slate-100": variant === "default",
      "bg-slate-700 text-slate-200": variant === "secondary",
      "bg-emerald-500/20 text-emerald-200": variant === "success"
    },
    className
  )}
  >
  <slot />
</span>
