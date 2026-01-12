<script lang="ts">
  import { cn } from "../../lib/utils";
  import type { Snippet } from "../../lib/utils";

  let {
    open = $bindable(false),
    onClose,
    className = "",
    children,
  } = $props<{
    open?: boolean;
    onClose?: () => void;
    className?: string;
    children?: Snippet;
  }>();

  const close = () => {
    open = false;
    onClose?.();
  };
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" 
      role="button"
      tabindex="0"
      aria-label="Close dialog"
      onclick={close}
      onkeydown={(e) => e.key === "Escape" || e.key === "Enter" || e.key === " " ? close() : null}
    >
    <div
      class={cn(
        "w-full max-w-lg rounded-lg border border-slate-800 bg-slate-950 p-6 shadow-xl",
        className
      )}
      onclick={(e) => e.stopPropagation()}
    >
      {@render children?.()}
    </div>
  </div>
{/if}
