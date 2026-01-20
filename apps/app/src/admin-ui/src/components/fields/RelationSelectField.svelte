<script lang="ts">
  import { onMount } from "svelte";
  import { cn } from "../../lib/utils";
  import { apiGet } from "../../lib/api";

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
      const response = await apiGet<any>(optionsEndpoint);
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
  <label class="block text-sm font-medium text-foreground">
    {label}
    {#if required}<span class="text-destructive">*</span>{/if}
  </label>
  <select
    bind:value
    disabled={readonly || loading}
    class={cn(
      "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
      (readonly || loading) && "opacity-60 cursor-not-allowed",
      displayError && "border-destructive"
    )}
  >
    <option value="">{loading ? "Loading..." : placeholder}</option>
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  {#if help && !displayError}
    <p class="text-xs text-muted-foreground">{help}</p>
  {/if}
  {#if displayError}
    <p class="text-xs text-destructive">{displayError}</p>
  {/if}
</div>
