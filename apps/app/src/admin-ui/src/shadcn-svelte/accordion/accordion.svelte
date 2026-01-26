<script lang="ts">
	import { Accordion as AccordionPrimitive } from "bits-ui";
	import { onMount } from "svelte";

	let {
		ref = $bindable(null),
		value = $bindable(),
		children,
		...restProps
	}: AccordionPrimitive.RootProps = $props();

	// Defer rendering to avoid effect_orphan errors from bits-ui
	// when component is hydrated via Astro islands
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});
</script>

{#if mounted}
	<AccordionPrimitive.Root
		bind:ref
		bind:value={value as never}
		data-slot="accordion"
		{...restProps}
	>
		{@render children?.()}
	</AccordionPrimitive.Root>
{/if}
