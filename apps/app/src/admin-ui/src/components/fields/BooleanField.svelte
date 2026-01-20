<script lang="ts">
  import { cn } from "../../lib/utils";

  interface Props {
    label: string;
    value?: boolean;
    help?: string;
    required?: boolean;
    readonly?: boolean;
    error?: string;
  }

  let {
    label,
    value = $bindable(false),
    help = "",
    required = false,
    readonly = false,
    error = ""
  }: Props = $props();
</script>

<div class="space-y-1.5">
  <label class={cn(
    "flex items-center gap-2 cursor-pointer",
    readonly && "opacity-60 cursor-not-allowed"
  )}>
    <input
      type="checkbox"
      bind:checked={value}
      disabled={readonly}
      class="w-4 h-4 rounded border-input text-foreground focus:ring-ring"
    />
    <span class="text-sm font-medium text-foreground">
      {label}
      {#if required}<span class="text-destructive">*</span>{/if}
    </span>
  </label>
  {#if help && !error}
    <p class="text-xs text-muted-foreground">{help}</p>
  {/if}
  {#if error}
    <p class="text-xs text-destructive">{error}</p>
  {/if}
</div>
