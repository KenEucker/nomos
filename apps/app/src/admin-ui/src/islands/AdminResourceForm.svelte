<script lang="ts">
  import { onMount } from "svelte";
  import Button from "../components/ui/button.svelte";
  import FieldRenderer from "./FieldRenderer.svelte";
  import { apiGet, apiPost, apiPatch } from "../lib/api";
  import type { AdminResource, FieldDef } from "../lib/resources/types";
  import { resolveEndpoint, getFieldsForView } from "../lib/resources/types";

  interface Props {
    resource: AdminResource;
    id?: string;
    mode: "create" | "edit";
    onSuccess?: (data: any) => void;
    onCancel?: () => void;
  }

  let {
    resource,
    id = "",
    mode,
    onSuccess,
    onCancel
  }: Props = $props();

  let formData = $state<Record<string, any>>({});
  let loading = $state(false);
  let loadingData = $state(mode === "edit");
  let error = $state<string | null>(null);
  let fieldErrors = $state<Record<string, string>>({});

  const fields = $derived(getFieldsForView(resource, mode));

  const initializeFormData = () => {
    const data: Record<string, any> = {};
    for (const field of fields) {
      if (field.defaultValue !== undefined) {
        data[field.name] = field.defaultValue;
      } else if (field.type === "boolean") {
        data[field.name] = false;
      } else if (field.type === "relation_many") {
        data[field.name] = [];
      } else if (field.type === "number") {
        data[field.name] = null;
      } else {
        data[field.name] = "";
      }
    }
    return data;
  };

  const loadExistingData = async () => {
    if (mode !== "edit" || !id) return;
    loadingData = true;
    try {
      const endpoint = resolveEndpoint(resource.endpoints.get, id);
      const response = await apiGet<any>(endpoint);
      const dataKey = resource.singleDataKey ?? resource.id.replace(/s$/, "");
      const data = response.data?.[dataKey] ?? response.data;
      // Initialize form data from response
      const newData: Record<string, any> = {};
      for (const field of fields) {
        if (data[field.name] !== undefined) {
          newData[field.name] = data[field.name];
        } else if (field.type === "boolean") {
          newData[field.name] = false;
        } else if (field.type === "relation_many") {
          newData[field.name] = [];
        } else {
          newData[field.name] = "";
        }
      }
      formData = newData;
    } catch (err: any) {
      error = err.message ?? "Failed to load data";
    } finally {
      loadingData = false;
    }
  };

  const validateForm = (): boolean => {
    fieldErrors = {};
    let valid = true;
    for (const field of fields) {
      const value = formData[field.name];
      if (field.required) {
        // For edit mode, password field is optional
        if (mode === "edit" && field.type === "password" && !value) {
          continue;
        }
        if (value === undefined || value === null || value === "") {
          fieldErrors[field.name] = `${field.label} is required`;
          valid = false;
        } else if (Array.isArray(value) && value.length === 0) {
          fieldErrors[field.name] = `${field.label} is required`;
          valid = false;
        }
      }
    }
    return valid;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!validateForm()) return;

    loading = true;
    error = null;
    try {
      // Prepare data for submission
      const submitData: Record<string, any> = {};
      for (const field of fields) {
        const value = formData[field.name];
        // Skip empty passwords on edit
        if (mode === "edit" && field.type === "password" && !value) {
          continue;
        }
        // Skip readonly fields
        if (field.readonly) {
          continue;
        }
        submitData[field.name] = value;
      }

      let response;
      if (mode === "create") {
        response = await apiPost<any>(resource.endpoints.create, submitData);
      } else {
        const endpoint = resolveEndpoint(resource.endpoints.update, id);
        response = await apiPatch<any>(endpoint, submitData);
      }

      const dataKey = resource.singleDataKey ?? resource.id.replace(/s$/, "");
      const resultData = response.data?.[dataKey] ?? response.data;
      onSuccess?.(resultData);
    } catch (err: any) {
      error = err.message ?? "Failed to save";
    } finally {
      loading = false;
    }
  };

  const handleCancel = () => {
    onCancel?.();
  };

  onMount(() => {
    if (mode === "create") {
      formData = initializeFormData();
    } else {
      loadExistingData();
    }
  });
</script>

<div class="max-w-2xl">
  {#if loadingData}
    <div class="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
      <div class="flex flex-col items-center gap-2">
        <div class="w-6 h-6 border-2 rounded-full animate-spin border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-200"></div>
        <span>Loading {resource.label.toLowerCase()}...</span>
      </div>
    </div>
  {:else}
    <form onsubmit={handleSubmit} class="space-y-6">
      {#if error}
        <div class="p-4 border rounded-lg border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      {/if}

      <div class="space-y-4">
        {#each fields as field}
          <FieldRenderer
            {field}
            bind:value={formData[field.name]}
            error={fieldErrors[field.name]}
          />
        {/each}
      </div>

      <div class="flex flex-col-reverse gap-2 pt-4 border-t border-slate-200 dark:border-slate-800 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onclick={handleCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {#if loading}
            <span class="inline-block w-4 h-4 mr-2 border-2 rounded-full animate-spin border-current border-t-transparent"></span>
          {/if}
          {mode === "create" ? `Create ${resource.label}` : `Save ${resource.label}`}
        </Button>
      </div>
    </form>
  {/if}
</div>
