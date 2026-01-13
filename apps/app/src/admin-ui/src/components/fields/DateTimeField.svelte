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
    type?: "datetime" | "date";
  }

  let {
    label,
    value = $bindable(""),
    placeholder = "",
    help = "",
    required = false,
    readonly = false,
    error = "",
    type = "datetime"
  }: Props = $props();

  // Convert ISO string to datetime-local format
  let localValue = $state("");

  $effect(() => {
    if (value) {
      try {
        const date = new Date(value);
        if (type === "date") {
          localValue = date.toISOString().split("T")[0];
        } else {
          localValue = date.toISOString().slice(0, 16);
        }
      } catch {
        localValue = value;
      }
    } else {
      localValue = "";
    }
  });

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    localValue = target.value;
    if (target.value) {
      try {
        const date = new Date(target.value);
        value = date.toISOString();
      } catch {
        value = target.value;
      }
    } else {
      value = "";
    }
  };
</script>

<div class="space-y-1.5">
  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
    {label}
    {#if required}<span class="text-red-500">*</span>{/if}
  </label>
  <Input
    type={type === "date" ? "date" : "datetime-local"}
    value={localValue}
    {placeholder}
    {readonly}
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
