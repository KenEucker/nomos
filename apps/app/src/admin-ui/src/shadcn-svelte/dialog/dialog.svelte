<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { tick } from "svelte";

	let { open = $bindable(false), children, ...restProps }: DialogPrimitive.RootProps = $props();

	// Use tick() to defer rendering until Svelte's effect context is ready
	// This fixes effect_orphan errors from bits-ui when hydrated via Astro islands
	const ready = tick();
</script>

{#await ready then}
	<DialogPrimitive.Root bind:open {...restProps}>
		{@render children?.()}
	</DialogPrimitive.Root>
{/await}
