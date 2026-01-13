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
  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
    {label}
    {#if required}<span class="text-red-500">*</span>{/if}
  </label>
  <textarea
    bind:value
    {placeholder}
    {readonly}
    {rows}
    class={cn(
      "flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ring-offset-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:ring-offset-slate-950",
      readonly && "opacity-60 cursor-not-allowed",
      error && "border-red-500"
    )}
  ></textarea>
  {#if help && !error}
    <p class="text-xs text-slate-500 dark:text-slate-400">{help}</p>
  {/if}
  {#if error}
    <p class="text-xs text-red-500">{error}</p>
  {/if}
</div>
