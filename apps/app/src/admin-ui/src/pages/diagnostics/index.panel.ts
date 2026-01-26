import { Layouts } from "../../lib/layouts"
import { panelApiFetch } from "../../lib/panel-api"
import type { PanelModule } from "../../lib/types"

type DiagnosticsCoreModule = {
  name: string
  enabled: boolean
  apiEnabled?: boolean
  uiEnabled?: boolean
}

type DiagnosticsOverview = {
  status?: string
  routes?: number
  jobs?: number
  events?: string[]
  coreModules?: DiagnosticsCoreModule[]
}

type DiagnosticsRoute = {
  method: string
  path: string
  id: string
}

type DiagnosticsJob = {
  id: string
  queue?: string
  schedule?: string
}

const panel: PanelModule = {
  id: "diagnostics",
  title: "Diagnostics",
  subtitle: "Inspect runtime health and system status.",
  menu: {
    group: "System",
    icon:
      '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  },
  query: async (ctx) => {
    const [overviewResponse, routesResponse, jobsResponse, eventsResponse] = await Promise.all([
      panelApiFetch(ctx, "/diagnostics"),
      panelApiFetch(ctx, "/diagnostics/routes"),
      panelApiFetch(ctx, "/diagnostics/jobs"),
      panelApiFetch(ctx, "/diagnostics/events"),
    ])

    const overview = (overviewResponse?.data ?? overviewResponse) as DiagnosticsOverview
    const routes = ((routesResponse?.data ?? routesResponse) as { routes?: DiagnosticsRoute[] })
      .routes ?? []
    const jobs = ((jobsResponse?.data ?? jobsResponse) as { jobs?: DiagnosticsJob[] }).jobs ?? []
    const events =
      ((eventsResponse?.data ?? eventsResponse) as { events?: string[] }).events ?? []

    const cards = [
      {
        label: "Status",
        value: overview?.status ?? "Unknown",
        description: "Runtime health",
      },
      {
        label: "Total Routes",
        value: overview?.routes ?? routes.length,
        description: "Registered endpoints",
      },
      {
        label: "Registered Jobs",
        value: overview?.jobs ?? jobs.length,
        description: "Scheduled workloads",
      },
      {
        label: "Event Types",
        value: overview?.events?.length ?? events.length,
        description: "Registered signals",
      },
    ]

    const coreModules = (overview?.coreModules ?? []).map((module) => ({
      name: module.name,
      state: module.enabled ? "Enabled" : "Disabled",
      api: module.apiEnabled === undefined ? "-" : module.apiEnabled ? "On" : "Off",
      ui: module.uiEnabled === undefined ? "-" : module.uiEnabled ? "On" : "Off",
    }))

    return {
      cards,
      coreModules,
      routes,
      jobs,
      events: events.map((event) => ({ name: event })),
    }
  },
  layout: (data) => {
    const cards = Array.isArray(data.cards) ? data.cards : []
    const cardColumns = cards.map((_, index) => ({
      span: 3,
      nodes: [
        Layouts.card({
          title: data.cards?.[index]?.label,
          description: data.cards?.[index]?.description,
          nodes: [
            Layouts.text({
              valueKey: `cards.${index}.value`,
            }),
          ],
        }),
      ],
    }))

    return [
      Layouts.rows([
        Layouts.header({
          title: "Diagnostics",
          subtitle: "Inspect runtime health and system status.",
          requiredIntent: "admin.access",
        }),
        Layouts.columns(cardColumns),
        Layouts.card({
          title: "Core Modules",
          description: "Platform modules and their runtime state.",
          nodes: [
            Layouts.table({
              key: "core-modules",
              rowsKey: "coreModules",
              columns: [
                { key: "name", label: "Module" },
                {
                  key: "state",
                  label: "State",
                  render: "badge",
                  badgeVariants: { Enabled: "success", Disabled: "secondary" },
                },
                { key: "api", label: "API" },
                { key: "ui", label: "UI" },
              ],
              searchable: false,
            }),
          ],
        }),
        Layouts.card({
          title: "Routes",
          description: "Registered admin and application endpoints.",
          nodes: [
            Layouts.table({
              key: "routes",
              rowsKey: "routes",
              columns: [
                { key: "method", label: "Method" },
                { key: "path", label: "Path" },
                { key: "id", label: "ID" },
              ],
              searchable: false,
            }),
          ],
        }),
        Layouts.card({
          title: "Jobs",
          description: "Scheduled jobs configured in this runtime.",
          nodes: [
            Layouts.table({
              key: "jobs",
              rowsKey: "jobs",
              columns: [
                { key: "id", label: "Job ID" },
                { key: "queue", label: "Queue" },
                { key: "schedule", label: "Schedule" },
              ],
              searchable: false,
            }),
          ],
        }),
        Layouts.card({
          title: "Events",
          description: "Event types the runtime can emit.",
          nodes: [
            Layouts.table({
              key: "events",
              rowsKey: "events",
              columns: [{ key: "name", label: "Event" }],
              searchable: false,
            }),
          ],
        }),
      ]),
    ]
  },
  commandBar: () => [],
}

export default panel
