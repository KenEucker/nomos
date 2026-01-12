<script>
  let { label, value = $bindable(false) } = $props();
</script>

<label>
  <input type="checkbox" bind:checked={value} />
  {label}
</label>
