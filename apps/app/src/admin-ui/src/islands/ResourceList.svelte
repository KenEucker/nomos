<script>
  export let resources = [];
  export let data = {};
</script>

<div class="resource-list">
  {#each resources as resource}
    <section>
      <h2>{resource.label}</h2>
      {#if data[resource.name]}
        <pre>{JSON.stringify(data[resource.name], null, 2)}</pre>
      {:else if data.users || data.roles || data.apiKeys}
        <pre>{JSON.stringify(data, null, 2)}</pre>
      {:else}
        <p>No data loaded.</p>
      {/if}
    </section>
  {/each}
</div>
