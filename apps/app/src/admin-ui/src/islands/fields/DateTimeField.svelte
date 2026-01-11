<script>
  export let label;
  export let value = "";
</script>

<label>{label}</label>
<input type="datetime-local" bind:value />
