import { createResourcePanel } from "../../lib/resource-panel"
import type { PanelModule } from "../../lib/types"
import { auditResource } from "./audit.resource"

const basePanel = createResourcePanel({
  resource: auditResource,
  mode: "list",
})

const panel: PanelModule = {
  ...basePanel,
  id: "audit-list",
  commandBar: (ctx, data) => [
    ...basePanel.commandBar(ctx, data),
    {
      type: "link",
      label: "Clear Log",
      href: "/admin/audit/clear",
      intent: "admin.access",
    },
  ],
}

export default panel
