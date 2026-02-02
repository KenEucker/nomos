import { getContext, setContext, type Component } from "svelte";

export const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
	[k in string]: {
		label?: string;
		icon?: Component;
	} & (
		| { color?: string; theme?: never }
		| { color?: never; theme: Record<keyof typeof THEMES, string> }
	);
};

/** Shape of a single item in the chart tooltip payload (from chart tooltip context). */
export type TooltipPayload = {
	key?: string;
	name?: string;
	label?: string;
	value?: unknown;
	payload?: Record<string, unknown>;
	color?: string;
	[k: string]: unknown;
};

export type ChartTooltipContext = { payload: TooltipPayload[] };

const chartTooltipContextKey = Symbol("chart-tooltip-context");

export function setChartTooltipContext(ctx: ChartTooltipContext): void {
	setContext(chartTooltipContextKey, ctx);
}

export function getChartTooltipContext(): ChartTooltipContext {
	return getContext<ChartTooltipContext>(chartTooltipContextKey) ?? {
		payload: [] as TooltipPayload[],
	};
}

// Helper to extract item config from a payload.
export function getPayloadConfigFromPayload(
	config: ChartConfig,
	payload: TooltipPayload,
	key: string
) {
	if (typeof payload !== "object" || payload === null) return undefined;

	const payloadPayload =
		"payload" in payload && typeof payload.payload === "object" && payload.payload !== null
			? payload.payload
			: undefined;

	let configLabelKey: string = key;

	if (payload.key === key) {
		configLabelKey = payload.key;
	} else if (payload.name === key) {
		configLabelKey = payload.name;
	} else if (key in payload && typeof payload[key as keyof typeof payload] === "string") {
		configLabelKey = payload[key as keyof typeof payload] as string;
	} else if (
		payloadPayload !== undefined &&
		key in payloadPayload &&
		typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
	) {
		configLabelKey = payloadPayload[key as keyof typeof payloadPayload] as string;
	}

	return configLabelKey in config ? config[configLabelKey] : config[key as keyof typeof config];
}

type ChartContextValue = {
	config: ChartConfig;
};

const chartContextKey = Symbol("chart-context");

export function setChartContext(value: ChartContextValue) {
	return setContext(chartContextKey, value);
}

export function useChart() {
	return getContext<ChartContextValue>(chartContextKey);
}
