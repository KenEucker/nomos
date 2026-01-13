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
      class="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:focus:ring-slate-600"
    />
    <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
      {#if required}<span class="text-red-500">*</span>{/if}
    </span>
  </label>
  {#if help && !error}
    <p class="text-xs text-slate-500 dark:text-slate-400">{help}</p>
  {/if}
  {#if error}
    <p class="text-xs text-red-500">{error}</p>
  {/if}
</div>
