<script lang="ts">
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "$ui/dialog";
  import Loader2Icon from "@lucide/svelte/icons/loader-2";
  import { apiFetch } from "../lib/api";

  const ENABLE_STEPS = [
    "Preparing…",
    "Merging schema…",
    "Generating client…",
    "Updating database…",
    "Finishing…",
  ];

  let { open = $bindable(false), slug = "", onSuccess = () => {}, onClose = () => {}, onError = (_: string) => {} } = $props();

  let stepCounter = $state(0);
  const stepText = $derived(ENABLE_STEPS[stepCounter % ENABLE_STEPS.length]);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function startStepCycle() {
    stepCounter = 0;
    intervalId = setInterval(() => {
      stepCounter = (stepCounter + 1) % ENABLE_STEPS.length;
    }, 2000);
  }

  function stopStepCycle() {
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  async function runEnable() {
    if (!slug) return;
    startStepCycle();
    try {
      await apiFetch(`/plugins/${slug}/enable`, { method: "POST" });
      stopStepCycle();
      onSuccess();
      onClose();
      open = false;
    } catch (err) {
      stopStepCycle();
      const message = err instanceof Error ? err.message : "Enable failed";
      onError(message);
      onClose();
      open = false;
    }
  }

  $effect(() => {
    if (open && slug) {
      runEnable();
    }
    return () => {
      stopStepCycle();
    };
  });
</script>

<Dialog bind:open onOpenChange={(isOpen: boolean) => { if (!isOpen) onClose(); }}>
  <DialogContent
    showCloseButton={false}
    portalProps={typeof globalThis.document !== 'undefined' && globalThis.document?.body ? { target: globalThis.document.body } : undefined}
  >
    <DialogHeader>
      <DialogTitle>Enabling plugin</DialogTitle>
      <DialogDescription>
        This may take a moment. Do not close this window.
      </DialogDescription>
    </DialogHeader>
    <div class="flex flex-col items-center gap-4 py-4">
      <Loader2Icon class="size-10 animate-spin text-primary" />
      <p class="text-sm font-medium text-foreground">{stepText}</p>
    </div>
  </DialogContent>
</Dialog>
