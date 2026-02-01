<script lang="ts">
	import ChartContainer from "./chart-container.svelte";
	import type { ChartConfig } from "./chart-utils.js";

	type Props = {
		data: Array<Record<string, unknown>>;
		categoryKey: string;
		valueKey: string;
		title?: string;
		description?: string;
	};

	let { data = [], categoryKey, valueKey, title, description }: Props = $props();

	const chartConfig = $derived.by(() => {
		const config: ChartConfig = {};
		const total = data.reduce(
			(s, r) => s + (Number(r[valueKey]) || 0),
			0
		);
		let hue = 0;
		for (const row of data) {
			const cat = String(row[categoryKey] ?? "");
			const val = Number(row[valueKey]) || 0;
			const pct = total > 0 ? (val / total) * 100 : 0;
			config[cat] = {
				label: cat,
				color: `hsl(${hue % 360}, 60%, 50%)`,
			};
			hue += 137;
		}
		return config;
	});

	const total = $derived(
		data.reduce((s, r) => s + (Number(r[valueKey]) || 0), 0)
	);

	const conicPartsStr = $derived.by(() => {
		if (total <= 0) return "";
		let prev = 0;
		const parts: string[] = [];
		let hue = 0;
		for (const row of data) {
			const val = Number(row[valueKey]) || 0;
			const pct = (val / total) * 100;
			parts.push(`hsl(${hue % 360}, 60%, 50%) ${prev}% ${prev + pct}%`);
			prev += pct;
			hue += 137;
		}
		return parts.join(", ");
	});
</script>

<div class="rounded-xl border bg-card p-6">
	{#if title}
		<div class="text-lg font-semibold text-foreground mb-2">{title}</div>
	{/if}
	{#if description}
		<div class="text-sm text-muted-foreground mb-4">{description}</div>
	{/if}
	{#if total > 0}
		<ChartContainer config={chartConfig} class="min-h-[200px]">
			<div class="flex gap-4 items-center flex-wrap">
				<div
					class="w-32 h-32 rounded-full flex-shrink-0"
					style="background: conic-gradient(from 0deg, {conicPartsStr});"
				></div>
				<ul class="text-sm space-y-1 min-w-0">
					{#each data as row, i}
						{@const val = Number(row[valueKey]) || 0}
						{@const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0"}
						{@const cat = String(row[categoryKey] ?? "")}
						{@const hue = (i * 137) % 360}
						<li class="flex items-center gap-2">
							<span
								class="w-3 h-3 rounded-full flex-shrink-0"
								style="background: hsl({hue}, 60%, 50%)"
							></span>
							<span class="truncate">{cat}</span>
							<span class="text-muted-foreground">{pct}%</span>
						</li>
					{/each}
				</ul>
			</div>
		</ChartContainer>
	{:else}
		<p class="text-sm text-muted-foreground">No data.</p>
	{/if}
</div>
