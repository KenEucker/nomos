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
  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
    {label}
    {#if required}<span class="text-red-500">*</span>{/if}
  </label>
  <select
    bind:value
    disabled={readonly}
    class={cn(
      "flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ring-offset-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:ring-offset-slate-950",
      readonly && "opacity-60 cursor-not-allowed",
      error && "border-red-500"
    )}
  >
    <option value="">{placeholder}</option>
    {#each normalizedOptions as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  {#if help && !error}
    <p class="text-xs text-slate-500 dark:text-slate-400">{help}</p>
  {/if}
  {#if error}
    <p class="text-xs text-red-500">{error}</p>
  {/if}
</div>
