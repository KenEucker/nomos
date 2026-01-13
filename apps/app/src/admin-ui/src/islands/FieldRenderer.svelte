<script lang="ts">
  import TextField from "../components/fields/TextField.svelte";
  import EmailField from "../components/fields/EmailField.svelte";
  import PasswordField from "../components/fields/PasswordField.svelte";
  import NumberField from "../components/fields/NumberField.svelte";
  import TextareaField from "../components/fields/TextareaField.svelte";
  import SelectField from "../components/fields/SelectField.svelte";
  import BooleanField from "../components/fields/BooleanField.svelte";
  import DateTimeField from "../components/fields/DateTimeField.svelte";
  import JsonField from "../components/fields/JsonField.svelte";
  import RelationSelectField from "../components/fields/RelationSelectField.svelte";
  import RelationMultiSelectField from "../components/fields/RelationMultiSelectField.svelte";
  import type { FieldDef } from "../lib/resources/types";

  interface Props {
    field: FieldDef;
    value?: any;
    readonly?: boolean;
    error?: string;
  }

  let {
    field,
    value = $bindable(),
    readonly = false,
    error = ""
  }: Props = $props();

  const effectiveReadonly = $derived(readonly || field.readonly);
</script>

{#if field.type === "email"}
  <EmailField
    label={field.label}
    bind:value
    placeholder={field.placeholder}
    help={field.help}
    required={field.required}
    readonly={effectiveReadonly}
    {error}
  />
{:else if field.type === "password"}
  <PasswordField
    label={field.label}
    bind:value
    placeholder={field.placeholder}
    help={field.help}
    required={field.required}
    readonly={effectiveReadonly}
    {error}
  />
{:else if field.type === "number"}
  <NumberField
    label={field.label}
    bind:value
    placeholder={field.placeholder}
    help={field.help}
    required={field.required}
    readonly={effectiveReadonly}
    min={(field as any).min}
    max={(field as any).max}
    step={(field as any).step}
    {error}
  />
{:else if field.type === "textarea"}
  <TextareaField
    label={field.label}
    bind:value
    placeholder={field.placeholder}
    help={field.help}
    required={field.required}
    readonly={effectiveReadonly}
    rows={(field as any).rows}
    {error}
  />
{:else if field.type === "enum"}
  <SelectField
    label={field.label}
    bind:value
    options={(field as any).options ?? []}
    placeholder={field.placeholder ?? "Select..."}
    help={field.help}
    required={field.required}
    readonly={effectiveReadonly}
    {error}
  />
{:else if field.type === "boolean"}
  <BooleanField
    label={field.label}
    bind:value
    help={field.help}
    required={field.required}
    readonly={effectiveReadonly}
    {error}
  />
{:else if field.type === "datetime"}
  <DateTimeField
    label={field.label}
    bind:value
    placeholder={field.placeholder}
    help={field.help}
    required={field.required}
    readonly={effectiveReadonly}
    type="datetime"
    {error}
  />
{:else if field.type === "date"}
  <DateTimeField
    label={field.label}
    bind:value
    placeholder={field.placeholder}
    help={field.help}
    required={field.required}
    readonly={effectiveReadonly}
    type="date"
    {error}
  />
{:else if field.type === "json"}
  <JsonField
    label={field.label}
    bind:value
    placeholder={field.placeholder}
    help={field.help}
    required={field.required}
    readonly={effectiveReadonly}
    rows={(field as any).rows}
    {error}
  />
{:else if field.type === "relation"}
  <RelationSelectField
    label={field.label}
    bind:value
    placeholder={field.placeholder}
    help={field.help}
    required={field.required}
    readonly={effectiveReadonly}
    optionsEndpoint={(field as any).optionsEndpoint ?? `/${(field as any).relationResource}`}
    valueKey={(field as any).valueKey}
    labelKey={(field as any).labelKey}
    {error}
  />
{:else if field.type === "relation_many"}
  <RelationMultiSelectField
    label={field.label}
    bind:value
    placeholder={field.placeholder}
    help={field.help}
    required={field.required}
    readonly={effectiveReadonly}
    optionsEndpoint={(field as any).optionsEndpoint ?? `/${(field as any).relationResource}`}
    valueKey={(field as any).valueKey}
    labelKey={(field as any).labelKey}
    {error}
  />
{:else}
  <TextField
    label={field.label}
    bind:value
    placeholder={field.placeholder}
    help={field.help}
    required={field.required}
    readonly={effectiveReadonly}
    {error}
  />
{/if}
