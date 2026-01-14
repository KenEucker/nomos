<script lang="ts">
  import type { Snippet } from "../lib/utils";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import { apiDelete } from "../lib/api";
  import { toasts } from "../lib/toast";

  type Props = { children?: Snippet };
  let { children }: Props = $props();

  let confirmOpen = $state(false);
  let deleting = $state(false);
  let selectedId = $state<string | null>(null);
  let selectedName = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);

  const handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const trigger = target?.closest<HTMLElement>("[data-delete-user]");
    if (!trigger) return;
    event.preventDefault();
    selectedId = trigger.dataset.deleteUser ?? null;
    selectedName = trigger.dataset.deleteName ?? null;
    errorMessage = null;
    confirmOpen = true;
  };

  const buildErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      const code = (error as any).code ? ` (${(error as any).code})` : "";
      const details = (error as any).details ? `: ${JSON.stringify((error as any).details)}` : "";
      return `${error.message}${code}${details}`;
    }
    return "Failed to delete user.";
  };

  const confirmDelete = async () => {
    if (!selectedId) return;
    deleting = true;
    errorMessage = null;
    try {
      await apiDelete(`/users/${selectedId}`);
      toasts.success("User deleted successfully");
      confirmOpen = false;
      selectedId = null;
      selectedName = null;
      window.location.reload();
    } catch (error) {
      const message = buildErrorMessage(error);
      errorMessage = message;
      toasts.error(message);
    } finally {
      deleting = false;
    }
  };
</script>

<div on:click={handleClick}>
  {@render children?.()}
</div>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Delete user"
  message={selectedName ? `Delete ${selectedName}? This cannot be undone.` : "Delete this user? This cannot be undone."}
  confirmLabel="Delete user"
  confirmVariant="destructive"
  loading={deleting}
  onConfirm={confirmDelete}
  onCancel={() => {
    errorMessage = null;
  }}
/>

{#if errorMessage}
  <div class="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
    {errorMessage}
  </div>
{/if}
