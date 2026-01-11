<script>
  import FieldRenderer from "./FieldRenderer.svelte";
  export let resource;

  let formData = {};

  const submit = async () => {
    await fetch(resource.route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });
  };
</script>

{#if resource}
  <form class="resource-form" on:submit|preventDefault={submit}>
    <h3>Create {resource.label}</h3>
    {#each resource.fields as field}
      <FieldRenderer {field} bind:value={formData[field.name]} />
    {/each}
    <button type="submit">Create</button>
  </form>
{/if}
