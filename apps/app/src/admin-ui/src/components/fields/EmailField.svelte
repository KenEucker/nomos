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
  }

  let {
    label,
    value = $bindable(""),
    placeholder = "",
    help = "",
    required = false,
    readonly = false,
    error = ""
  }: Props = $props();
</script>

<div class="space-y-1.5">
  <label class="block text-sm font-medium text-foreground">
    {label}
    {#if required}<span class="text-destructive">*</span>{/if}
  </label>
  <Input
    type="email"
    bind:value
    {placeholder}
    {readonly}
    className={error ? "border-destructive" : ""}
  />
  {#if help && !error}
    <p class="text-xs text-muted-foreground">{help}</p>
  {/if}
  {#if error}
    <p class="text-xs text-destructive">{error}</p>
  {/if}
</div>
