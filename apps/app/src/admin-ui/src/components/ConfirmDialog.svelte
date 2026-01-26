<script lang="ts">
  import { onMount, onDestroy } from "svelte"
  import * as Dialog from "$ui/dialog"
  import { Button } from "$ui/button"
  import { confirmDialogStore } from "../lib/confirm-dialog"

  // Initialize from store immediately
  const initialState = confirmDialogStore.get()
  let dialogOpen = $state(initialState.open)
  let title = $state(initialState.title)
  let body = $state<string | undefined>(initialState.body)
  let confirmLabel = $state(initialState.confirmLabel ?? "Yes")
  let cancelLabel = $state(initialState.cancelLabel ?? "No")
  let variant = $state<"default" | "destructive">(initialState.variant ?? "default")

  let unsubscribe: (() => void) | undefined

  onMount(() => {
    unsubscribe = confirmDialogStore.subscribe((state) => {
      dialogOpen = state.open
      title = state.title
      body = state.body
      confirmLabel = state.confirmLabel ?? "Yes"
      cancelLabel = state.cancelLabel ?? "No"
      variant = state.variant ?? "default"
    })
  })

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe()
    }
  })

  function handleConfirm() {
    confirmDialogStore.close(true)
  }

  function handleCancel() {
    confirmDialogStore.close(false)
  }
</script>

<Dialog.Root bind:open={dialogOpen}>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>{title}</Dialog.Title>
        {#if body}
          <Dialog.Description>{body}</Dialog.Description>
        {/if}
      </Dialog.Header>
      <Dialog.Footer>
        <Button variant="outline" onclick={handleCancel}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onclick={handleConfirm}>
          {confirmLabel}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
