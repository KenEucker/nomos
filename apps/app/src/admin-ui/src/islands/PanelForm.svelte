<script lang="ts">
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$ui/card"
  import { Button } from "$ui/button"
  import { Input } from "$ui/input"
  import { Textarea } from "$ui/textarea"
  import { Checkbox } from "$ui/checkbox"
  import { NativeSelect, NativeSelectOption } from "$ui/native-select"
  import MultiSelect from "../components/svelte-multiselect"
  import type { JSONSchema7 } from "json-schema"
  import { onMount } from "svelte"
  import { apiFetch } from "../lib/api"
  import type { FieldDef } from "../lib/types"

  export let id: string
  export let title: string | undefined = undefined
  export let description: string | undefined = undefined
  export let schema: JSONSchema7 | undefined = undefined
  export let fields: FieldDef[] = []
  export let submitLabel: string | undefined = undefined
  export let submitEndpoint: string
  export let submitMethod: "POST" | "PUT" | "PATCH" | undefined = undefined
  export let initialValuesKey: string | undefined = undefined
  export let after: "refresh" | "navigate" | undefined = undefined
  export let redirectTo: string | undefined = undefined
  export let data: Record<string, any> = {}
  export let onRefresh: () => void

  const resolveRequiredFields = (formFields: FieldDef[], jsonSchema?: JSONSchema7) => {
    if (Array.isArray(jsonSchema?.required)) {
      return new Set(jsonSchema?.required)
    }
    return new Set(formFields.filter((field) => field.required).map((field) => field.name))
  }

  const validateRequiredFields = (formFields: FieldDef[], jsonSchema: JSONSchema7 | undefined, valuesToValidate: Record<string, any>) => {
    const requiredFields = resolveRequiredFields(formFields, jsonSchema)
    const nextErrors: Record<string, string> = {}

    for (const field of formFields) {
      if (!requiredFields.has(field.name)) continue
      const value = valuesToValidate[field.name]
      const isMissing =
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "")

      if (isMissing) {
        nextErrors[field.name] = "This field is required."
      }
    }

    return nextErrors
  }

  let values: Record<string, any> = {}
  let fieldErrors: Record<string, string> = {}
  let formError: string | null = null
  let submitting = false
  let remoteOptions: Record<string, Array<{ value: string; label: string }>> = {}

  $: values = { ...values, ...(initialValuesKey ? data?.[initialValuesKey] ?? {} : {}) }

  const resolveHelperText = (field: FieldDef) => field.helperText ?? field.help

  const resolveOptions = (field: FieldDef) => {
    if (field.options?.length) return field.options
    return remoteOptions[field.name] ?? []
  }

  const normalizeOptionsPayload = (
    field: FieldDef,
    payload: unknown
  ): Array<{ value: string; label: string }> => {
    if (!payload) return []

    const data = (payload as { data?: unknown }).data ?? payload
    const raw =
      field.optionsKey && typeof data === "object" && data !== null
        ? (data as Record<string, unknown>)[field.optionsKey]
        : data

    const list = Array.isArray(raw) ? raw : []

    return list.map((item) => {
      if (typeof item === "object" && item !== null) {
        const valueKey = field.valueKey ?? "id"
        const labelKey = field.labelKey ?? "name"
        const record = item as Record<string, unknown>
        return {
          value: String(record[valueKey] ?? ""),
          label: String(record[labelKey] ?? record[valueKey] ?? ""),
        }
      }
      return { value: String(item), label: String(item) }
    })
  }

  const loadRemoteOptions = async () => {
    const fieldsNeedingOptions = fields.filter(
      (field) => field.optionsEndpoint && !(field.options?.length)
    )

    if (!fieldsNeedingOptions.length) return

    await Promise.all(
      fieldsNeedingOptions.map(async (field) => {
        try {
          const payload = await apiFetch<Record<string, unknown>>(field.optionsEndpoint!)
          const options = normalizeOptionsPayload(field, payload)
          remoteOptions = { ...remoteOptions, [field.name]: options }
        } catch {
          remoteOptions = { ...remoteOptions, [field.name]: [] }
        }
      })
    )
  }

  onMount(() => {
    loadRemoteOptions()
  })

  const validate = () => {
    const requiredErrors = validateRequiredFields(fields, schema, values)

    if (Object.keys(requiredErrors).length) {
      fieldErrors = requiredErrors
      formError = "Please fix the errors below."
      return false
    }

    // Placeholder for future JSON Schema validation (Ajv or server-side).
    fieldErrors = {}
    formError = null
    return true
  }

  const updateValue = (name: string, next: any) => {
    values = { ...values, [name]: next }
  }

  const submit = async () => {
    if (!validate()) return
    submitting = true
    formError = null
    try {
      const payload: Record<string, any> = {}
      for (const field of fields) {
        let value = values[field.name]
        if (field.transform === "lines" && typeof value === "string") {
          value = value
            .split(/[\n,]+/)
            .map((entry) => entry.trim())
            .filter(Boolean)
        }
        if (field.transform === "csv" && typeof value === "string") {
          value = value
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
        }
        payload[field.name] = value
      }
      await apiFetch(submitEndpoint, {
        method: submitMethod ?? "POST",
        body: JSON.stringify(payload),
      })

      if (after === "navigate" && redirectTo) {
        window.location.href = redirectTo
        return
      }

      if (after === "refresh") {
        onRefresh()
      }
    } catch (err) {
      formError = err instanceof Error ? err.message : "Submission failed"
    } finally {
      submitting = false
    }
  }
</script>

<Card>
  {#if title || description}
    <CardHeader>
      {#if title}
        <CardTitle>{title}</CardTitle>
      {/if}
      {#if description}
        <CardDescription>{description}</CardDescription>
      {/if}
    </CardHeader>
  {/if}

  <CardContent class="space-y-4">
    {#if formError}
      <div class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {formError}
      </div>
    {/if}

    {#each fields as field (field.name)}
      <div class="space-y-2">
        <label class="text-sm font-medium" for={`${id}-${field.name}`}>{field.label}</label>

        {#if field.readonly}
          <div class="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {values[field.name] ?? "—"}
          </div>
        {:else if field.type === "textarea"}
          <Textarea
            id={`${id}-${field.name}`}
            placeholder={field.placeholder}
            value={values[field.name] ?? ""}
            oninput={(e) => updateValue(field.name, (e.currentTarget as HTMLTextAreaElement).value)}
          />
        {:else if field.type === "checkbox"}
          <div class="flex items-center gap-2">
            <Checkbox
              id={`${id}-${field.name}`}
              checked={Boolean(values[field.name])}
              onCheckedChange={(checked: boolean) => updateValue(field.name, Boolean(checked))}
            />
            {#if field.helperText}
              <div class="text-xs text-muted-foreground">{field.helperText}</div>
            {/if}
          </div>
        {:else if field.type === "select"}
          {@const options = resolveOptions(field)}
          <NativeSelect
            id={`${id}-${field.name}`}
            value={values[field.name] ?? ""}
            onchange={(event) => updateValue(field.name, (event.currentTarget as HTMLSelectElement).value)}
          >
            <NativeSelectOption value="">Select {field.label}</NativeSelectOption>
            {#each options as option (option.value)}
              <NativeSelectOption value={option.value}>{option.label}</NativeSelectOption>
            {/each}
          </NativeSelect>
        {:else if field.type === "multiselect"}
          {@const options = resolveOptions(field)}
          {@const selectedItems = options.filter((option) =>
            Array.isArray(values[field.name]) ? values[field.name].includes(option.value) : false
          )}
          <MultiSelect
            items={options}
            selected={selectedItems}
            placeholder={`Select ${field.label}`}
            invalid={Boolean(fieldErrors[field.name])}
            on:change={(event) =>
              updateValue(
                field.name,
                event.detail.selected.map((item) => item.value)
              )}
          />
        {:else}
          {@const inputType =
            field.type === "email"
              ? "email"
              : field.type === "password"
                ? "password"
                : field.type === "number"
                  ? "number"
                  : field.type === "date"
                    ? "date"
                    : field.type === "datetime"
                      ? "datetime-local"
                      : "text"}
          <Input
            id={`${id}-${field.name}`}
            type={inputType}
            placeholder={field.placeholder}
            value={values[field.name] ?? ""}
            oninput={(e) => updateValue(field.name, (e.currentTarget as HTMLInputElement).value)}
          />
        {/if}

        {#if resolveHelperText(field) && field.type !== "checkbox"}
          <div class="text-xs text-muted-foreground">{resolveHelperText(field)}</div>
        {/if}

        {#if fieldErrors[field.name]}
          <div class="text-xs text-destructive">{fieldErrors[field.name]}</div>
        {/if}
      </div>
    {/each}

    <div class="flex justify-end">
      <Button onclick={submit} disabled={submitting}>
        {submitting ? "Saving…" : submitLabel ?? "Save"}
      </Button>
    </div>
  </CardContent>
</Card>
