<script>
  let { label, value = $bindable(""), options = [] } = $props();
</script>

<label>{label}</label>
<select bind:value>
  <option value="">Select...</option>
  {#each options as option}
    <option value={option}>{option}</option>
  {/each}
</select>
