<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { onMount } from "svelte";

	let { open = $bindable(false), children, ...restProps }: DialogPrimitive.RootProps = $props();

	// Defer rendering to avoid effect_orphan errors from bits-ui
	// when component is hydrated via Astro islands
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});
</script>

{#if mounted}
	<DialogPrimitive.Root bind:open {...restProps}>
		{@render children?.()}
	</DialogPrimitive.Root>
{/if}
