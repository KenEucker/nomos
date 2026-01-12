<script>
  let { label, value = $bindable("") } = $props();
</script>

<label>{label}</label>
<input type="email" bind:value />
