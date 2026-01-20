<script lang="ts">
  import { onMount } from "svelte";
  import { cn } from "../../lib/utils";
  import { apiGet } from "../../lib/api";
  import { Badge } from "$ui/input"
  import { Button } from "$ui/button"

  interface Props {
    label: string;
    value?: string[];
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
    value = $bindable<string[]>([]),
    placeholder = "Select items...",
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
  let showDropdown = $state(false);

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

  const toggleOption = (optionValue: string) => {
    if (readonly) return;
    if (value.includes(optionValue)) {
      value = value.filter((v) => v !== optionValue);
    } else {
      value = [...value, optionValue];
    }
  };

  const removeItem = (optionValue: string) => {
    if (readonly) return;
    value = value.filter((v) => v !== optionValue);
  };

  const getLabel = (optionValue: string): string => {
    const option = options.find((o) => o.value === optionValue);
    return option?.label ?? optionValue;
  };

  const availableOptions = $derived(
    options.filter((o) => !value.includes(o.value))
  );

  const displayError = $derived(error || loadError);
</script>

<div class="space-y-1.5">
  <label class="block text-sm font-medium text-foreground">
    {label}
    {#if required}<span class="text-destructive">*</span>{/if}
  </label>

  <!-- Selected items -->
  <div class={cn(
    "min-h-[2.5rem] p-2 rounded-md border border-input bg-background",
    readonly && "opacity-60",
    displayError && "border-destructive"
  )}>
    {#if value.length === 0}
      <span class="text-sm text-muted-foreground">{placeholder}</span>
    {:else}
      <div class="flex flex-wrap gap-1">
        {#each value as v}
          <Badge variant="secondary" className="flex items-center gap-1">
            {getLabel(v)}
            {#if !readonly}
              <button
                type="button"
                class="ml-1 hover:text-destructive"
                onclick={() => removeItem(v)}
              >
                ×
              </button>
            {/if}
          </Badge>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Add button and dropdown -->
  {#if !readonly && !loading}
    <div class="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onclick={() => { showDropdown = !showDropdown; }}
        disabled={availableOptions.length === 0}
      >
        Add {label}
      </Button>

      {#if showDropdown && availableOptions.length > 0}
        <div
          class="absolute z-10 w-full mt-1 overflow-auto bg-background border rounded-md shadow-lg max-h-48 border-input"
          role="listbox"
        >
          {#each availableOptions as option}
            <button
              type="button"
              class="w-full px-3 py-2 text-sm text-left hover:bg-accent"
              onclick={() => { toggleOption(option.value); showDropdown = false; }}
            >
              {option.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if loading}
    <p class="text-xs text-muted-foreground">Loading options...</p>
  {/if}

  {#if help && !displayError}
    <p class="text-xs text-muted-foreground">{help}</p>
  {/if}
  {#if displayError}
    <p class="text-xs text-destructive">{displayError}</p>
  {/if}
</div>
