<script lang="ts">
  import { toasts, type Toast } from "../../lib/toast";
  import { cn } from "../../lib/utils";

  let toastList = $state<Toast[]>([]);

  const unsubscribe = toasts.subscribe((value) => {
    toastList = value;
  });

  const icons: Record<string, string> = {
    success: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>`,
    error: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>`,
    warning: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>`,
    info: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>`
  };

  const handleDismiss = (id: string) => {
    toasts.remove(id);
  };
</script>

{#if toastList.length > 0}
  <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
    {#each toastList as toast (toast.id)}
      <div
        class={cn(
          "flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all animate-in slide-in-from-right",
          {
            "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-200": toast.type === "success",
            "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200": toast.type === "error",
            "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200": toast.type === "warning",
            "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200": toast.type === "info"
          }
        )}
        role="alert"
      >
        <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {@html icons[toast.type]}
        </svg>
        <div class="flex-1 text-sm font-medium">{toast.message}</div>
        <button
          type="button"
          class="flex-shrink-0 opacity-70 hover:opacity-100"
          onclick={() => handleDismiss(toast.id)}
          aria-label="Dismiss"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  @keyframes slide-in-from-right {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  .animate-in {
    animation: slide-in-from-right 0.3s ease-out;
  }
</style>
