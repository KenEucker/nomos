<script lang="ts">
  import Input from "../../components/ui/input.svelte";

  interface Props {
    label: string;
    value?: number | null;
    placeholder?: string;
    help?: string;
    required?: boolean;
    readonly?: boolean;
    min?: number;
    max?: number;
    step?: number;
    error?: string;
  }

  let {
    label,
    value = $bindable<number | null>(null),
    placeholder = "",
    help = "",
    required = false,
    readonly = false,
    min,
    max,
    step,
    error = ""
  }: Props = $props();

  let stringValue = $state(value?.toString() ?? "");

  $effect(() => {
    stringValue = value?.toString() ?? "";
  });

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const num = parseFloat(target.value);
    value = isNaN(num) ? null : num;
    stringValue = target.value;
  };
</script>

<div class="space-y-1.5">
  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
    {label}
    {#if required}<span class="text-red-500">*</span>{/if}
  </label>
  <Input
    type="number"
    value={stringValue}
    {placeholder}
    {readonly}
    {min}
    {max}
    {step}
    oninput={handleInput}
    className={error ? "border-red-500" : ""}
  />
  {#if help && !error}
    <p class="text-xs text-slate-500 dark:text-slate-400">{help}</p>
  {/if}
  {#if error}
    <p class="text-xs text-red-500">{error}</p>
  {/if}
</div>
