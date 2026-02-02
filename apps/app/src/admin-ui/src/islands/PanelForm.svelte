<script lang="ts">
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$ui/card"
  import { Button } from "$ui/button"
  import { Input } from "$ui/input"
  import { Textarea } from "$ui/textarea"
  import { Checkbox } from "$ui/checkbox"
  import { NativeSelect, NativeSelectOption } from "$ui/native-select"
  import MultiSelect from "../components/svelte-multiselect"
  import type { JSONSchema7 } from "json-schema"
  import { onMount, untrack } from "svelte"
  import { apiFetch } from "../lib/api"
  import type { FieldDef } from "../lib/types"

  interface PanelFormProps {
    id: string
    title?: string | null
    description?: string | null
    schema?: JSONSchema7 | null
    fields?: FieldDef[]
    submitLabel?: string | null
    submitEndpoint?: string | null
    submitMethod?: "POST" | "PUT" | "PATCH" | null
    initialValuesKey?: string | null
    after?: "refresh" | "navigate" | null
    redirectTo?: string | null
    data?: Record<string, any> | null
    onRefresh?: (() => void) | null
  }

  let {
    id,
    title = undefined,
    description = undefined,
    schema = undefined,
    fields = [],
    submitLabel = undefined,
    submitEndpoint = "",
    submitMethod = undefined,
    initialValuesKey = undefined,
    after = undefined,
    redirectTo = undefined,
    data = {},
    onRefresh = () => {},
  }: PanelFormProps = $props()

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

  // Initialize values with data if available (only spread when it's a non-null object)
  const rawInitial = $derived.by(() => initialValuesKey && data?.[initialValuesKey])
  const safeInitial = $derived.by(() => {
    const raw = rawInitial
    return raw != null && typeof raw === "object" && !Array.isArray(raw)
      ? { ...raw }
      : {}
  })
  let values = $state<Record<string, any>>({})
  $effect(() => {
    const initial = safeInitial
    const valuesEmpty = untrack(() => Object.keys(values).length === 0)
    if (valuesEmpty) {
      values = { ...initial }
    }
  })
  let fieldErrors = $state<Record<string, string>>({})
  let formError = $state<string | null>(null)
  let submitting = $state(false)
  let remoteOptions = $state<Record<string, Array<{ value: string; label: string }>>>({})
  /** After create, if response included a one-time secret (e.g. API key token), show it before redirecting */
  let createdSecret = $state<string | null>(null)
  let createdRedirectTo = $state<string | null>(null)
  let copiedSecret = $state(false)

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

    // Unwrap { ok, data } from API response
    const data = (payload as { data?: unknown }).data ?? payload
    const raw =
      field.optionsKey && typeof data === "object" && data !== null
        ? (data as Record<string, unknown>)[field.optionsKey]
        : Array.isArray(data)
          ? data
          : field.optionsKey && typeof (payload as Record<string, unknown>)[field.optionsKey] !== "undefined"
            ? (payload as Record<string, unknown>)[field.optionsKey]
            : data

    const list = Array.isArray(raw) ? raw : []

    const mapped = list.map((item) => {
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

    // Deduplicate by value so keyed each blocks (e.g. multiselect) never see duplicate keys
    const seen = new Set<string>()
    return mapped.filter((opt) => {
      if (seen.has(opt.value)) return false
      seen.add(opt.value)
      return true
    })
  }

  const loadRemoteOptions = async () => {
    const fieldsNeedingOptions = fields.filter(
      (field) => field.optionsEndpoint && !(field.options?.length)
    )

    if (!fieldsNeedingOptions.length) return

    const results = await Promise.all(
      fieldsNeedingOptions.map(async (field: FieldDef) => {
        try {
          const payload = await apiFetch<Record<string, unknown>>(field.optionsEndpoint!)
          const options = normalizeOptionsPayload(field, payload)
          return { field, options }
        } catch {
          return { field, options: [] as Array<{ value: string; label: string }> }
        }
      })
    )
    type OptionsMap = Record<string, Array<{ value: string; label: string }>>
    remoteOptions = results.reduce<OptionsMap>(
      (acc, { field, options }) => ({ ...acc, [field.name]: options }),
      { ...remoteOptions }
    )
  }

  onMount(() => {
    loadRemoteOptions()
  })

  const validate = () => {
    const requiredErrors = validateRequiredFields(fields, schema!, values)
    const patternErrors: Record<string, string> = {}
    for (const field of fields) {
      if (!field.pattern) continue
      const value = values[field.name]
      if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) continue
      const str = typeof value === "string" ? value : String(value)
      try {
        if (!new RegExp(field.pattern).test(str)) {
          patternErrors[field.name] = field.patternMessage ?? "Invalid format."
        }
      } catch {
        // invalid regex in field def — skip
      }
    }
    const nextErrors = { ...requiredErrors, ...patternErrors }
    if (Object.keys(nextErrors).length) {
      fieldErrors = nextErrors
      formError = "Please fix the errors below."
      return false
    }
    fieldErrors = {}
    formError = null
    return true
  }

  const updateValue = (name: string, next: any) => {
    values = { ...values, [name]: next }
  }

  const submit = async () => {
    if (!validate()) return
    if (!submitEndpoint) {
      formError = "Submit endpoint is required"
      return
    }
    submitting = true
    formError = null
    try {
      const payload: Record<string, any> = {}
      for (const field of fields) {
        let value = values[field.name]
        if (field.type === "multiselect" && value === undefined) {
          value = []
        }
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
      const response = await apiFetch<Record<string, any>>(submitEndpoint, {
        method: submitMethod ?? "POST",
        body: JSON.stringify(payload),
      })

      const token = response?.data?.token
      if (typeof token === "string" && token.length > 0) {
        createdSecret = token
        createdRedirectTo = after === "navigate" && redirectTo ? redirectTo : null
        return
      }

      if (after === "navigate" && redirectTo) {
        window.location.href = redirectTo
        return
      }

      if (after === "refresh") {
        onRefresh?.()
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
    {#if createdSecret}
      <div class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
        <p class="text-sm font-medium text-foreground">
          Copy your key now — it won't be shown again.
        </p>
        <div class="flex items-center gap-2">
          <code class="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono break-all select-all">
            {createdSecret}
          </code>
          <Button
            type="button"
            variant="outline"
            onclick={async () => {
              try {
                await navigator.clipboard.writeText(createdSecret ?? "")
                copiedSecret = true
              } catch {
                // ignore
              }
            }}
          >
            {copiedSecret ? "Copied" : "Copy"}
          </Button>
        </div>
        {#if createdRedirectTo}
          <Button
            type="button"
            onclick={() => {
              window.location.href = createdRedirectTo ?? "#"
            }}
          >
            Go to list
          </Button>
        {/if}
      </div>
    {:else}
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
    {/if}
  </CardContent>
</Card>
