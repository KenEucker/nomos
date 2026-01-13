<script lang="ts">
  import Input from "../../components/ui/input.svelte";

  interface Props {
    label: string;
    value?: string;
    placeholder?: string;
    help?: string;
    required?: boolean;
    readonly?: boolean;
    error?: string;
  }

  let {
    label,
    value = $bindable(""),
    placeholder = "",
    help = "",
    required = false,
    readonly = false,
    error = ""
  }: Props = $props();
</script>

<div class="space-y-1.5">
  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
    {label}
    {#if required}<span class="text-red-500">*</span>{/if}
  </label>
  <Input
    type="password"
    bind:value
    {placeholder}
    {readonly}
    className={error ? "border-red-500" : ""}
  />
  {#if help && !error}
    <p class="text-xs text-slate-500 dark:text-slate-400">{help}</p>
  {/if}
  {#if error}
    <p class="text-xs text-red-500">{error}</p>
  {/if}
</div>
