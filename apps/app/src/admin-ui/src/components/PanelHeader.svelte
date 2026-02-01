<script lang="ts">
  import type { ActionDescriptor } from "../lib/types"
  import { can, notifyDeny } from "../lib/authz/authorize.client"

  export let title: string
  export let subtitle: string | undefined = undefined
  export let commands: ActionDescriptor[] = []
  export let onCommand: (command: ActionDescriptor) => void

  const isDenied = (intent: string) => Boolean(intent) && !can(intent)
  const handleCommand = (command: ActionDescriptor) => {
    if (isDenied(command.intent!)) {
      notifyDeny(command.intent as string)
      return
    }
    onCommand(command)
  }
</script>

<header class="rounded-xl border bg-card p-6">
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold text-foreground">{title}</h1>
      {#if subtitle}
        <p class="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      {/if}
    </div>
    {#if commands.length}
      <div class="flex flex-wrap gap-2">
        {#each commands as command (command.label)}
          {@const commandDenied = isDenied(command.intent!)}
          {#if command.type === "link"}
            <button
              type="button"
              aria-disabled={commandDenied}
              class={commandDenied
                ? "rounded-md border px-4 py-2 text-sm font-medium opacity-60 cursor-not-allowed"
                : "rounded-md border px-4 py-2 text-sm font-medium"}
              onclick={() => handleCommand(command)}
            >
              {command.label}
            </button>
          {:else}
            <button
              class={commandDenied
                ? "rounded-md bg-primary/60 px-4 py-2 text-sm font-medium text-primary-foreground cursor-not-allowed"
                : "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"}
              type="button"
              aria-disabled={commandDenied}
              onclick={() => handleCommand(command)}
            >
              {command.label}
            </button>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</header>
