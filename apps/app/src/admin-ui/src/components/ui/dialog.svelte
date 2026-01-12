<script lang="ts">
  import { cn } from "../../lib/utils";
  export let open = false;
  export let onClose: (() => void) | undefined;
  export let className = "";

  const close = () => {
    onClose?.();
  };
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" on:click={close}>
    <div
      class={cn(
        "w-full max-w-lg rounded-lg border border-slate-800 bg-slate-950 p-6 shadow-xl",
        className
      )}
      on:click|stopPropagation
    >
      <slot />
    </div>
  </div>
{/if}
