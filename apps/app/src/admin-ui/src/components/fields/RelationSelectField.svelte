<script lang="ts">
  import { onMount } from "svelte";
  import { cn } from "../../lib/utils";
  const sdkModulePromise = import("/sdk/client.js");

  interface Props {
    label: string;
    value?: string | null;
    placeholder?: string;
    help?: string;
    required?: boolean;
    readonly?: boolean;
    error?: string;
    optionsEndpoint: string;
    valueKey: string;
    labelKey: string;
    dataKey?: string;
  }

  let {
    label,
    value = $bindable<string | null>(null),
    placeholder = "Select...",
    help = "",
    required = false,
    readonly = false,
    error = "",
    optionsEndpoint,
    valueKey,
    labelKey,
    dataKey = ""
  }: Props = $props();

  let options = $state<Array<{ value: string; label: string }>>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  const loadOptions = async () => {
    loading = true;
    loadError = null;
    try {
      const client = (await sdkModulePromise).getSingletonClient();
      const response = await client.GET(optionsEndpoint);
      let data = response.data;
      if (dataKey && data?.[dataKey]) {
        data = data[dataKey];
      } else if (Array.isArray(response.data)) {
        data = response.data;
      } else {
        // Try to find the first array in the response
        const keys = Object.keys(data || {});
        for (const key of keys) {
          if (Array.isArray(data[key])) {
            data = data[key];
            break;
          }
        }
      }
      if (Array.isArray(data)) {
        options = data.map((item: any) => ({
          value: String(item[valueKey] ?? item.id ?? ""),
          label: String(item[labelKey] ?? item.name ?? item[valueKey] ?? "")
        }));
      } else {
        options = [];
      }
    } catch (err: any) {
      loadError = err.message ?? "Failed to load options";
      options = [];
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    loadOptions();
  });

  const displayError = $derived(error || loadError);
</script>

<div class="space-y-1.5">
  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
    {label}
    {#if required}<span class="text-red-500">*</span>{/if}
  </label>
  <select
    bind:value
    disabled={readonly || loading}
    class={cn(
      "flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ring-offset-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:ring-offset-slate-950",
      (readonly || loading) && "opacity-60 cursor-not-allowed",
      displayError && "border-red-500"
    )}
  >
    <option value="">{loading ? "Loading..." : placeholder}</option>
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  {#if help && !displayError}
    <p class="text-xs text-slate-500 dark:text-slate-400">{help}</p>
  {/if}
  {#if displayError}
    <p class="text-xs text-red-500">{displayError}</p>
  {/if}
</div>
