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
  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
    {label}
    {#if required}<span class="text-red-500">*</span>{/if}
  </label>
  <textarea
    value={stringValue}
    {placeholder}
    {readonly}
    {rows}
    oninput={handleInput}
    class={cn(
      "flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ring-offset-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:ring-offset-slate-950",
      readonly && "opacity-60 cursor-not-allowed",
      displayError && "border-red-500"
    )}
  ></textarea>
  {#if help && !displayError}
    <p class="text-xs text-slate-500 dark:text-slate-400">{help}</p>
  {/if}
  {#if displayError}
    <p class="text-xs text-red-500">{displayError}</p>
  {/if}
</div>
