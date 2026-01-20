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

const panel: PanelModule = (() => {
  const config = getConfig()
  if (!config) return fallbackPanel
  return createResourcePanel(config)
})()

export default panel
