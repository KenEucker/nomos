import { Layouts } from "../../lib/layouts"
import { panelApiFetch } from "../../lib/panel-api"
import type { PanelModule } from "../../lib/types"

type ObservabilityHealth = {
  bestEffortQueueDepth: number
  durableQueueDepth: number
  droppedBestEffortTotal: number
  droppedDurableTotal: number
  lastFlushDurationMs?: number
  lastFlushAt?: number
  sinkFailuresTotal: number
  spoolQueueDepth?: number
}

type ObservabilityStatus = {
  enabled: boolean
  health?: ObservabilityHealth
  eventStore?: {
    enabled: boolean
    count: number
    maxEvents: number
    countByKind?: Record<string, number>
    countByLevel?: Record<string, number>
  }
  spool?: {
    enabled: boolean
    queued: number
    filePath: string
    lastError?: string
  }
  config?: {
    env: string
    explanationsEnabled: boolean
    telemetryEnabled: boolean
    decideEnabled: boolean
    consoleSinkEnabled: boolean
    eventStoreEnabled: boolean
  }
}

type ObservabilityEvent = {
  name: string
  kind: string
  level?: string
  outcome?: string
  source: string
  timestamp: number
  timestampISO: string
  context: {
    requestId?: string
    actorId?: string
  }
  data: Record<string, unknown>
}

const panel: PanelModule = {
  id: "observability",
  title: "Observability",
  subtitle: "Monitor events, health, and telemetry.",
  query: async (ctx) => {
    const [statusResponse, eventsResponse] = await Promise.all([
      panelApiFetch(ctx, "/_/observability"),
      panelApiFetch(ctx, "/_/observability/events?limit=50"),
    ])

    const status = (statusResponse?.data ?? statusResponse) as ObservabilityStatus
    const eventsData = (eventsResponse?.data ?? eventsResponse) as {
      events?: ObservabilityEvent[]
      total?: number
    }
    const events = eventsData.events ?? []

    // Build stats cards
    const cards = [
      {
        label: "Status",
        value: status.enabled ? "Active" : "Disabled",
        description: "Observability system state",
      },
      {
        label: "Events Stored",
        value: status.eventStore?.count ?? 0,
        description: `of ${status.eventStore?.maxEvents ?? 0} max`,
      },
      {
        label: "Queue Depth",
        value: (status.health?.bestEffortQueueDepth ?? 0) + (status.health?.durableQueueDepth ?? 0),
        description: "Pending events",
      },
      {
        label: "Dropped Events",
        value: (status.health?.droppedBestEffortTotal ?? 0) + (status.health?.droppedDurableTotal ?? 0),
        description: "Due to backpressure",
      },
    ]

    // Build kind distribution
    const kindCounts = status.eventStore?.countByKind ?? {}
    const kindDistribution = Object.entries(kindCounts).map(([kind, count]) => ({
      kind,
      count,
    }))

    // Build level distribution
    const levelCounts = status.eventStore?.countByLevel ?? {}
    const levelDistribution = Object.entries(levelCounts).map(([level, count]) => ({
      level,
      count,
    }))

    // Format recent events for display
    const recentEvents = events.slice(0, 20).map((event) => ({
      time: event.timestampISO?.substring(11, 19) ?? "—",
      name: event.name,
      kind: event.kind,
      level: event.level ?? "info",
      source: event.source,
      outcome: event.outcome ?? "—",
      requestId: event.context?.requestId?.substring(0, 8) ?? "—",
    }))

    // Config info
    const configItems = status.config
      ? [
          { setting: "Environment", value: status.config.env },
          { setting: "Explanations", value: status.config.explanationsEnabled ? "On" : "Off" },
          { setting: "Telemetry", value: status.config.telemetryEnabled ? "On" : "Off" },
          { setting: "DECIDE Artifacts", value: status.config.decideEnabled ? "On" : "Off" },
          { setting: "Console Sink", value: status.config.consoleSinkEnabled ? "On" : "Off" },
          { setting: "Event Store", value: status.config.eventStoreEnabled ? "On" : "Off" },
        ]
      : []

    // Spool info
    const spoolInfo = status.spool?.enabled
      ? [
          { metric: "Queued Events", value: status.spool.queued },
          { metric: "File Path", value: status.spool.filePath },
          { metric: "Last Error", value: status.spool.lastError ?? "None" },
        ]
      : []

    return {
      cards,
      kindDistribution,
      levelDistribution,
      recentEvents,
      configItems,
      spoolInfo,
      spoolEnabled: status.spool?.enabled ?? false,
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
          title: "Observability",
          subtitle: "Monitor events, health, and telemetry.",
          requiredIntent: "admin.access",
        }),
        Layouts.columns(cardColumns),
        Layouts.columns([
          {
            span: 6,
            nodes: [
              Layouts.card({
                title: "Events by Kind",
                description: "Distribution of event types.",
                nodes: [
                  Layouts.table({
                    key: "kind-distribution",
                    rowsKey: "kindDistribution",
                    columns: [
                      { key: "kind", label: "Kind", render: "badge" },
                      { key: "count", label: "Count" },
                    ],
                    searchable: false,
                  }),
                ],
              }),
            ],
          },
          {
            span: 6,
            nodes: [
              Layouts.card({
                title: "Events by Level",
                description: "Distribution of severity levels.",
                nodes: [
                  Layouts.table({
                    key: "level-distribution",
                    rowsKey: "levelDistribution",
                    columns: [
                      {
                        key: "level",
                        label: "Level",
                        render: "badge",
                        badgeVariants: {
                          error: "destructive",
                          warn: "warning",
                          info: "default",
                          debug: "secondary",
                        },
                      },
                      { key: "count", label: "Count" },
                    ],
                    searchable: false,
                  }),
                ],
              }),
            ],
          },
        ]),
        Layouts.card({
          title: "Recent Events",
          description: "Last 20 observability events.",
          nodes: [
            Layouts.table({
              key: "recent-events",
              rowsKey: "recentEvents",
              columns: [
                { key: "time", label: "Time" },
                { key: "name", label: "Event" },
                {
                  key: "kind",
                  label: "Kind",
                  render: "badge",
                  badgeVariants: {
                    audit: "default",
                    decision: "secondary",
                    security: "destructive",
                    log: "outline",
                    metric: "success",
                    trace: "secondary",
                  },
                },
                {
                  key: "level",
                  label: "Level",
                  render: "badge",
                  badgeVariants: {
                    error: "destructive",
                    warn: "warning",
                    info: "default",
                    debug: "secondary",
                  },
                },
                { key: "source", label: "Source" },
                { key: "outcome", label: "Outcome" },
                { key: "requestId", label: "Request" },
              ],
              searchable: false,
            }),
          ],
        }),
        Layouts.columns([
          {
            span: 6,
            nodes: [
              Layouts.card({
                title: "Configuration",
                description: "Current observability settings.",
                nodes: [
                  Layouts.table({
                    key: "config",
                    rowsKey: "configItems",
                    columns: [
                      { key: "setting", label: "Setting" },
                      { key: "value", label: "Value" },
                    ],
                    searchable: false,
                  }),
                ],
              }),
            ],
          },
          {
            span: 6,
            nodes: [
              Layouts.card({
                title: "Spool Status",
                description: "Durable event storage.",
                nodes: [
                  Layouts.table({
                    key: "spool",
                    rowsKey: "spoolInfo",
                    columns: [
                      { key: "metric", label: "Metric" },
                      { key: "value", label: "Value" },
                    ],
                    searchable: false,
                  }),
                ],
              }),
            ],
          },
        ]),
      ]),
    ]
  },
  commandBar: () => [
    {
      label: "Clear Events",
      action: {
        type: "api",
        method: "POST",
        url: "/_/observability",
        body: { action: "clear" },
        confirm: "Are you sure you want to clear all stored events?",
        successMessage: "Events cleared",
      },
    },
    {
      label: "Cleanup Spool",
      action: {
        type: "api",
        method: "POST",
        url: "/_/observability",
        body: { action: "cleanup" },
        successMessage: "Spool cleaned up",
      },
    },
  ],
}

export default panel
