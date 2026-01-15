<script lang="ts">
  import { onMount } from "svelte";
  import Button from "../components/ui/button.svelte";
  import FieldRenderer from "./FieldRenderer.svelte";
  const sdkModulePromise = import("/sdk/client.js");
  import { toasts } from "../lib/toast";
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
  let loadingData = $state(true); // Start loading for both modes
  let error = $state<string | null>(null);
  let fieldErrors = $state<Record<string, string>>({});

  const fields = $derived(getFieldsForView(resource, mode));

  const requireEndpoint = (key: keyof AdminResource["endpoints"]) => {
    const endpoint = resource.endpoints[key];
    if (!endpoint) {
      throw new Error(`Missing required endpoint "${key}" for resource "${resource.id}".`);
    }
    return endpoint;
  };

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
      const endpoint = resolveEndpoint(requireEndpoint("get"), id);
      const client = (await sdkModulePromise).getSingletonClient();
      const response = await client.GET(endpoint);
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
        if (field.submitTransform) {
          submitData[field.name] = field.submitTransform(value);
        } else {
          submitData[field.name] = value;
        }
      }

      let response;
      const client = (await sdkModulePromise).getSingletonClient();
      if (mode === "create") {
        response = await client.POST(requireEndpoint("create"), { body: submitData });
      } else {
        const endpoint = resolveEndpoint(requireEndpoint("update"), id);
        response = await client.PATCH(endpoint, { body: submitData });
      }

      const dataKey = resource.singleDataKey ?? resource.id.replace(/s$/, "");
      const resultData = response.data?.[dataKey] ?? response.data;

      // Show success toast
      const action = mode === "create" ? "created" : "updated";
      toasts.success(`${resource.label} ${action} successfully`);

      onSuccess?.(resultData);
    } catch (err: any) {
      // Handle validation errors with field-specific details
      // Backend returns: { error: { details: { info: { issues: [...] } } } }
      const issues = err.details?.info?.issues ?? err.details?.issues ?? (Array.isArray(err.details) ? err.details : null);

      if (issues && Array.isArray(issues)) {
        const newFieldErrors: Record<string, string> = {};
        for (const issue of issues) {
          const fieldName = issue.path?.[0] ?? issue.field;
          if (fieldName) {
            newFieldErrors[fieldName] = issue.message;
          }
        }
        if (Object.keys(newFieldErrors).length > 0) {
          fieldErrors = newFieldErrors;
          // Build a summary of all errors
          const errorMessages = Object.entries(newFieldErrors)
            .map(([field, msg]) => `${field}: ${msg}`)
            .join("; ");
          error = errorMessages || "Please fix the errors below";
          toasts.error("Validation failed: " + errorMessages);
        } else {
          error = err.message ?? "Failed to save";
          toasts.error(error);
        }
      } else {
        error = err.message ?? "Failed to save";
        toasts.error(error);
      }
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
      loadingData = false;
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
