<script>
  import TextField from "./fields/TextField.svelte";
  import EmailField from "./fields/EmailField.svelte";
  import SelectField from "./fields/SelectField.svelte";
  import BooleanField from "./fields/BooleanField.svelte";
  import DateTimeField from "./fields/DateTimeField.svelte";

  export let field;
  export let value;
</script>

{#if field.type === "email"}
  <EmailField label={field.name} bind:value />
{:else if field.type === "select"}
  <SelectField label={field.name} options={field.options ?? []} bind:value />
{:else if field.type === "boolean"}
  <BooleanField label={field.name} bind:value />
{:else if field.type === "datetime"}
  <DateTimeField label={field.name} bind:value />
{:else}
  <TextField label={field.name} bind:value />
{/if}
