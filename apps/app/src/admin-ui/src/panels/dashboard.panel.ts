import { apiGet } from "$lib/api"
import { Layouts } from "../lib/layouts"
import { panelApiFetch } from "../lib/panel-api"
import type { PanelModule } from "../lib/types"
import { dashboardResource } from "../pages/dashboard.resource"

type DashboardCard = {
  label: string
  value: string | number
  description?: string
}

const extractCards = (payload: unknown): DashboardCard[] => {
  const data = (payload as { data?: unknown })?.data ?? payload ?? {}
  const listKey = dashboardResource.dataKey ?? dashboardResource.name
  const items = (data as Record<string, unknown>)[listKey]
  return Array.isArray(items) ? (items as DashboardCard[]) : []
}

const panel: PanelModule = {
  id: "dashboard",
  title: "Dashboard",
  subtitle: "Overview of system activity.",
  query: async (ctx) => {
    const endpoint = dashboardResource.endpoints.list
    if (!endpoint) return { cards: [] }
    const response = await panelApiFetch(ctx, endpoint)
    return { cards: extractCards(response) }
  },
  layout: (data) => {
    const cards = Array.isArray(data.cards) ? data.cards : []
    const stats = cards.map((card, index) =>
      Layouts.card({
        title: card.label,
        description: card.description,
        nodes: [
          Layouts.text({
            valueKey: `cards.${index}.value`,
          }),
        ],
      })
    )

    return [
      Layouts.rows([
        Layouts.header({
          title: "Dashboard",
          subtitle: "Overview of system activity.",
          requiredIntent: dashboardResource.intents?.read,
        }),
        Layouts.columns(
          stats.map((node) => ({
            span: 4,
            nodes: [node],
          }))
        ),
        Layouts.table({
          key: dashboardResource.name,
          title: "Summary",
          description: "Live system metrics.",
          rowsKey: "cards",
          columns: dashboardResource.list?.columns ?? [],
          searchable: false,
          requiredIntent: dashboardResource.intents?.read,
        }),
      ]),
    ]
  },
  commandBar: () => [],
}

export default panel
