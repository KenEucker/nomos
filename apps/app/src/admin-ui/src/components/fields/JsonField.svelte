<script lang="ts">
  import { cn } from "../../lib/utils";

  interface Props {
    label: string;
    value?: unknown;
    placeholder?: string;
    help?: string;
    required?: boolean;
    readonly?: boolean;
    rows?: number;
    error?: string;
  }

  let {
    label,
    value = $bindable<unknown>(null),
    placeholder = "{}",
    help = "",
    required = false,
    readonly = false,
    rows = 6,
    error = ""
  }: Props = $props();

  let stringValue = $state("");
  let parseError = $state<string | null>(null);

  $effect(() => {
    try {
      stringValue = value ? JSON.stringify(value, null, 2) : "";
    } catch {
      stringValue = "";
    }
  });

  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    stringValue = target.value;
    parseError = null;

    if (!target.value.trim()) {
      value = null;
      return;
    }

    try {
      value = JSON.parse(target.value);
    } catch (err) {
      parseError = "Invalid JSON";
    }
  };

  const displayError = $derived(error || parseError);
</script>

<div class="space-y-1.5">
  <label class="block text-sm font-medium text-foreground">
    {label}
    {#if required}<span class="text-destructive">*</span>{/if}
  </label>
  <textarea
    value={stringValue}
    {placeholder}
    {readonly}
    {rows}
    oninput={handleInput}
    class={cn(
      "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
      readonly && "opacity-60 cursor-not-allowed",
      displayError && "border-destructive"
    )}
  ></textarea>
  {#if help && !displayError}
    <p class="text-xs text-muted-foreground">{help}</p>
  {/if}
  {#if displayError}
    <p class="text-xs text-destructive">{displayError}</p>
  {/if}
</div>
