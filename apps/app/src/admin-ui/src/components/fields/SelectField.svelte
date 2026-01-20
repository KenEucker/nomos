<script lang="ts">
  import { cn } from "../../lib/utils";

  interface Props {
    label: string;
    value?: string;
    options: Array<{ value: string; label: string } | string>;
    placeholder?: string;
    help?: string;
    required?: boolean;
    readonly?: boolean;
    error?: string;
  }

  let {
    label,
    value = $bindable(""),
    options = [],
    placeholder = "Select...",
    help = "",
    required = false,
    readonly = false,
    error = ""
  }: Props = $props();

  const normalizedOptions = $derived(
    options.map((opt) => (typeof opt === "string" ? { value: opt, label: opt } : opt))
  );
</script>

<div class="space-y-1.5">
  <label class="block text-sm font-medium text-foreground">
    {label}
    {#if required}<span class="text-destructive">*</span>{/if}
  </label>
  <select
    bind:value
    disabled={readonly}
    class={cn(
      "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
      readonly && "opacity-60 cursor-not-allowed",
      error && "border-destructive"
    )}
  >
    <option value="">{placeholder}</option>
    {#each normalizedOptions as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  {#if help && !error}
    <p class="text-xs text-muted-foreground">{help}</p>
  {/if}
  {#if error}
    <p class="text-xs text-destructive">{error}</p>
  {/if}
</div>
