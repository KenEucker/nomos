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
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
    role="dialog"
    aria-modal="true"
    onclick={close}
    onkeydown={(e) => {
      // Only close on Escape, not on other keys
      if (e.key === "Escape") {
        close();
      }
    }}
  >
    <div
      class={cn(
        "max-h-[90vh] w-full overflow-y-auto rounded-t-xl border border-slate-200 bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-lg sm:p-6 dark:border-slate-800 dark:bg-slate-950",
        className
      )}
      role="document"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      {@render children?.()}
    </div>
  </div>
{/if}
