<script>
  export let label;
  export let value = false;
</script>

<label>
  <input type="checkbox" bind:checked={value} />
  {label}
</label>
