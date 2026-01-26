<script lang="ts">
	import { Accordion as AccordionPrimitive } from "bits-ui";
	import { tick } from "svelte";

	let {
		ref = $bindable(null),
		value = $bindable(),
		children,
		...restProps
	}: AccordionPrimitive.RootProps = $props();

	// Use tick() to defer rendering until Svelte's effect context is ready
	// This fixes effect_orphan errors from bits-ui when hydrated via Astro islands
	const ready = tick();
</script>

{#await ready then}
	<AccordionPrimitive.Root
		bind:ref
		bind:value={value as never}
		data-slot="accordion"
		{...restProps}
	>
		{@render children?.()}
	</AccordionPrimitive.Root>
{/await}
