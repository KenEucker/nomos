<script lang="ts">
  import { cn } from "../../lib/utils";

  interface Props {
    label: string;
    value?: string;
    placeholder?: string;
    help?: string;
    required?: boolean;
    readonly?: boolean;
    rows?: number;
    error?: string;
  }

  let {
    label,
    value = $bindable(""),
    placeholder = "",
    help = "",
    required = false,
    readonly = false,
    rows = 4,
    error = ""
  }: Props = $props();
</script>

<div class="space-y-1.5">
  <label class="block text-sm font-medium text-foreground">
    {label}
    {#if required}<span class="text-destructive">*</span>{/if}
  </label>
  <textarea
    bind:value
    {placeholder}
    {readonly}
    {rows}
    class={cn(
      "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
      readonly && "opacity-60 cursor-not-allowed",
      error && "border-destructive"
    )}
  ></textarea>
  {#if help && !error}
    <p class="text-xs text-muted-foreground">{help}</p>
  {/if}
  {#if error}
    <p class="text-xs text-destructive">{error}</p>
  {/if}
</div>
