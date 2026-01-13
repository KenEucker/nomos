<script lang="ts">
  import Dialog from "../components/ui/dialog.svelte";
  import Button from "../components/ui/button.svelte";

  interface Props {
    open?: boolean;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmVariant?: "default" | "destructive" | "secondary";
    loading?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
  }

  let {
    open = $bindable(false),
    title = "Confirm",
    message = "Are you sure?",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    confirmVariant = "default",
    loading = false,
    onConfirm,
    onCancel
  }: Props = $props();

  const handleConfirm = () => {
    onConfirm?.();
  };

  const handleCancel = () => {
    open = false;
    onCancel?.();
  };
</script>

<Dialog bind:open onClose={handleCancel}>
  <div class="space-y-4">
    <div>
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="ghost" onclick={handleCancel} disabled={loading}>
        {cancelLabel}
      </Button>
      <Button variant={confirmVariant} onclick={handleConfirm} disabled={loading}>
        {#if loading}
          <span class="inline-block w-4 h-4 mr-2 border-2 rounded-full animate-spin border-current border-t-transparent"></span>
        {/if}
        {confirmLabel}
      </Button>
    </div>
  </div>
</Dialog>
