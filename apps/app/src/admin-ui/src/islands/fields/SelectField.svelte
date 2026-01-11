<script>
  export let label;
  export let value = "";
  export let options = [];
</script>

<label>{label}</label>
<select bind:value>
  <option value="">Select...</option>
  {#each options as option}
    <option value={option}>{option}</option>
  {/each}
</select>
