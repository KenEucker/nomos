import type { PanelModule } from "./types"
import type { ResourcePanelConfig } from "./resource-panel"
import { createResourcePanel } from "./resource-panel"

const getConfig = (): ResourcePanelConfig | null => {
  if (typeof window === "undefined") {
    return null
  }

  return (window as unknown as { __RESOURCE_PANEL_CONFIG__?: ResourcePanelConfig })
    .__RESOURCE_PANEL_CONFIG__ ?? null
}

const fallbackPanel: PanelModule = {
  id: "resource",
  title: "Resource",
  query: async () => ({}),
  layout: () => [],
  commandBar: () => [],
}

// Cache the created panel, keyed by resource name
// This allows reuse within the same resource but invalidates when switching resources
let cachedPanel: PanelModule | null = null
let cachedResourceName: string | null = null

const getOrCreatePanel = (): PanelModule => {
  const config = getConfig()
  if (!config) return fallbackPanel

  const resourceName = config.resource.name
  if (cachedPanel && cachedResourceName === resourceName) {
    return cachedPanel
  }

  cachedPanel = createResourcePanel(config)
  cachedResourceName = resourceName
  return cachedPanel
}

// Create a dynamic panel that reads config on each method call
// This is necessary because the module is cached but the config changes on View Transitions navigation
const panel: PanelModule = {
  get id() {
    return getOrCreatePanel().id
  },
  get title() {
    return getOrCreatePanel().title
  },
  query: async (ctx) => {
    return getOrCreatePanel().query(ctx)
  },
  layout: (data, ctx) => {
    return getOrCreatePanel().layout(data, ctx)
  },
  commandBar: (ctx, data) => {
    return getOrCreatePanel().commandBar(ctx, data)
  },
}

export default panel
