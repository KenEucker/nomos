import { Layouts } from "../../../lib/layouts"
import { panelApiFetch } from "../../../lib/panel-api"
import type { PanelModule } from "../../../lib/types"

type JobRun = {
  id: string
  status: string
  trigger: string
  scheduledFor: string
  startedAt?: string
  finishedAt?: string
  attempt: number
  durationMs?: number
  error?: { message: string; code?: string }
  correlationId?: string
}

type JobDetail = {
  id: string
  name: string
  displayName: string
  namespace: string
  description?: string
  enabled: boolean
  triggers: {
    cron: string[]
    events: Array<{ type: string; filter?: Record<string, unknown> }>
    manual: { enabled: boolean; permission?: string }
  }
  execution: {
    timeoutMs: number
    cancelGraceMs?: number
    maxConcurrency: number
  }
  ui?: { category?: string; hidden?: boolean }
  modulePath: string
}

type JobSummary = {
  job?: JobDetail
  runs?: JobRun[]
  totalRuns?: number
  stats?: {
    succeeded: number
    failed: number
    running: number
  }
}

const formatStatus = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")
}

const formatDuration = (ms?: number) => {
  if (ms === undefined || ms === null) return "—"
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

const formatDateTime = (iso?: string) => {
  if (!iso) return "—"
  const date = new Date(iso)
  return date.toLocaleString()
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case "succeeded": return "success"
    case "failed": return "destructive"
    case "running": return "default"
    case "pending": return "secondary"
    case "cancelled": return "warning"
    case "timed_out": return "destructive"
    default: return "secondary"
  }
}

const panel: PanelModule = {
  id: "job-detail",
  title: "Job Detail",
  subtitle: "View job configuration and run history.",
  query: async (ctx) => {
    const jobId = ctx.params?.id as string
    if (!jobId) {
      return { error: "Job ID is required", job: null, runs: [] }
    }

    const response = await panelApiFetch(ctx, `/_/jobs/${encodeURIComponent(jobId)}`)
    const data = (response?.data ?? response) as JobSummary

    if (!data?.job) {
      return { error: "Job not found", job: null, runs: [] }
    }

    const job = data.job as JobDetail
    const runs = (data.runs ?? []) as JobRun[]
    const totalRuns = data.totalRuns ?? 0
    const stats = data.stats ?? { succeeded: 0, failed: 0, running: 0 }

    // Format job info
    const jobInfo = [
      { label: "ID", value: job.id },
      { label: "Namespace", value: job.namespace },
      { label: "Module Path", value: job.modulePath },
      { label: "Status", value: job.enabled ? "Enabled" : "Disabled" },
    ]

    // Format execution config
    const executionConfig = [
      { setting: "Timeout", value: formatDuration(job.execution.timeoutMs) },
      { setting: "Cancel Grace", value: formatDuration(job.execution.cancelGraceMs ?? 5000) },
      { setting: "Max Concurrency", value: String(job.execution.maxConcurrency) },
    ]

    // Format triggers
    const triggerInfo: Array<{ type: string; config: string }> = []
    if (job.triggers.cron?.length > 0) {
      job.triggers.cron.forEach(expr => {
        triggerInfo.push({ type: "Cron", config: expr })
      })
    }
    if (job.triggers.events?.length > 0) {
      job.triggers.events.forEach(evt => {
        triggerInfo.push({ type: "Event", config: evt.type })
      })
    }
    if (job.triggers.manual?.enabled) {
      triggerInfo.push({
        type: "Manual",
        config: job.triggers.manual.permission ?? "Any user with jobs.manage"
      })
    }

    // Format runs
    const runRows = runs.map(run => ({
      id: run.id,
      idShort: run.id.substring(0, 8),
      status: formatStatus(run.status),
      statusVariant: getStatusVariant(run.status),
      trigger: run.trigger.charAt(0).toUpperCase() + run.trigger.slice(1),
      scheduledFor: formatDateTime(run.scheduledFor),
      startedAt: formatDateTime(run.startedAt),
      finishedAt: formatDateTime(run.finishedAt),
      duration: formatDuration(run.durationMs),
      attempt: run.attempt,
      error: run.error?.message ?? "—",
      correlationId: run.correlationId?.substring(0, 8) ?? "—",
      canCancel: run.status === "pending" || run.status === "running",
    }))

    return {
      job,
      jobInfo,
      executionConfig,
      triggerInfo,
      runRows,
      totalRuns,
      stats, // Use stats from API (accurate totals, not paginated subset)
      manualEnabled: job.triggers.manual?.enabled ?? false,
      hasError: false,
    }
  },
  layout: (data) => {
    if (data.error) {
      return [
        Layouts.rows([
          Layouts.header({
            title: "Job Not Found",
            subtitle: data.error as string,
            requiredIntent: "jobs.manage",
          }),
        ]),
      ]
    }

    const job = data.job as JobDetail

    return [
      Layouts.rows([
        Layouts.header({
          title: job?.displayName ?? "Job",
          subtitle: job?.description ?? "View job configuration and run history.",
          requiredIntent: "jobs.manage",
        }),
        Layouts.columns([
          {
            span: 3,
            nodes: [
              Layouts.card({
                title: "Succeeded",
                description: "Successful runs",
                nodes: [Layouts.text({ valueKey: "stats.succeeded" })],
              }),
            ],
          },
          {
            span: 3,
            nodes: [
              Layouts.card({
                title: "Failed",
                description: "Failed/timed out runs",
                nodes: [Layouts.text({ valueKey: "stats.failed" })],
              }),
            ],
          },
          {
            span: 3,
            nodes: [
              Layouts.card({
                title: "Running",
                description: "Currently executing",
                nodes: [Layouts.text({ valueKey: "stats.running" })],
              }),
            ],
          },
          {
            span: 3,
            nodes: [
              Layouts.card({
                title: "Total Runs",
                description: "All time",
                nodes: [Layouts.text({ valueKey: "totalRuns" })],
              }),
            ],
          },
        ]),
        Layouts.columns([
          {
            span: 6,
            nodes: [
              Layouts.card({
                title: "Job Information",
                description: "Basic job configuration.",
                nodes: [
                  Layouts.table({
                    key: "job-info",
                    rowsKey: "jobInfo",
                    columns: [
                      { key: "label", label: "Property" },
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
                title: "Execution Config",
                description: "Runtime behavior settings.",
                nodes: [
                  Layouts.table({
                    key: "execution-config",
                    rowsKey: "executionConfig",
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
        ]),
        Layouts.card({
          title: "Triggers",
          description: "How this job can be started.",
          nodes: [
            Layouts.table({
              key: "triggers",
              rowsKey: "triggerInfo",
              columns: [
                { key: "type", label: "Type", render: "badge" },
                { key: "config", label: "Configuration" },
              ],
              searchable: false,
            }),
          ],
        }),
        Layouts.card({
          title: "Run History",
          description: "Recent job executions.",
          nodes: [
            Layouts.table({
              key: "runs",
              rowsKey: "runRows",
              columns: [
                { key: "idShort", label: "Run ID" },
                {
                  key: "status",
                  label: "Status",
                  render: "badge",
                  badgeVariants: {
                    Succeeded: "success",
                    Failed: "destructive",
                    Running: "default",
                    Pending: "secondary",
                    Cancelled: "warning",
                    "Timed out": "destructive",
                  },
                },
                { key: "trigger", label: "Trigger" },
                { key: "startedAt", label: "Started" },
                { key: "duration", label: "Duration" },
                { key: "attempt", label: "Attempt" },
                { key: "error", label: "Error" },
              ],
              searchable: false,
            }),
          ],
        }),
      ]),
    ]
  },
  commandBar: (_ctx, data) => {
    const commands = []

    if (data?.manualEnabled && data?.job) {
      commands.push({
        type: "method" as const,
        label: "Run Now",
        endpoint: `/_/jobs/${encodeURIComponent((data.job as JobDetail).id)}`,
        method: "POST" as const,
        payload: () => ({}),
        confirm: { title: "Run this job now?" },
        toast: { success: "Job run started" },
      })
    }

    commands.push({
      type: "link" as const,
      label: "Back to Jobs",
      href: "/admin/jobs",
    })

    return commands
  },
}

export default panel
