import { Layouts } from "../../lib/layouts"
import { panelApiFetch } from "../../lib/panel-api"
import type { PanelModule } from "../../lib/types"

type JobTriggers = {
  cron: string[]
  events: string[]
  manualEnabled: boolean
}

type JobLastRun = {
  id: string
  status: string
  trigger: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
}

type JobSummary = {
  id: string
  name: string
  displayName: string
  namespace: string
  description?: string
  enabled: boolean
  lastRun?: JobLastRun
  totalRuns: number
  runningCount: number
  cronExpressions: string[]
  eventTriggers: string[]
  manualEnabled: boolean
}

const formatStatus = (status?: string) => {
  if (!status) return "—"
  return status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")
}

const formatDuration = (ms?: number) => {
  if (ms === undefined || ms === null) return "—"
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

const formatTriggers = (job: JobSummary) => {
  const parts: string[] = []
  if (job.cronExpressions?.length > 0) {
    parts.push(`Cron (${job.cronExpressions.length})`)
  }
  if (job.eventTriggers?.length > 0) {
    parts.push(`Events (${job.eventTriggers.length})`)
  }
  if (job.manualEnabled) {
    parts.push("Manual")
  }
  return parts.join(", ") || "None"
}

const panel: PanelModule = {
  id: "jobs",
  title: "Jobs",
  subtitle: "Manage background jobs and view run history.",
  query: async (ctx) => {
    const response = await panelApiFetch(ctx, "/_/jobs")
    const jobs = ((response?.data ?? response)?.jobs ?? []) as JobSummary[]

    // Calculate stats
    const totalJobs = jobs.length
    const runningJobs = jobs.filter(j => j.runningCount > 0).length
    const enabledJobs = jobs.filter(j => j.enabled).length
    const cronJobs = jobs.filter(j => j.cronExpressions?.length > 0).length

    // Prepare job rows for table
    const jobRows = jobs.map(job => ({
      id: job.id,
      displayName: job.displayName,
      namespace: job.namespace,
      description: job.description ?? "—",
      status: job.runningCount > 0 ? "Running" : (job.enabled ? "Idle" : "Disabled"),
      statusVariant: job.runningCount > 0 ? "success" : (job.enabled ? "default" : "secondary"),
      lastStatus: formatStatus(job.lastRun?.status),
      lastStatusVariant: job.lastRun?.status === "succeeded" ? "success" :
                         job.lastRun?.status === "failed" ? "destructive" :
                         job.lastRun?.status === "running" ? "default" :
                         job.lastRun?.status === "cancelled" ? "warning" :
                         job.lastRun?.status === "timed_out" ? "destructive" : "secondary",
      totalRuns: job.totalRuns,
      lastDuration: formatDuration(job.lastRun?.durationMs),
      triggers: formatTriggers(job),
      manualEnabled: job.manualEnabled,
      _link: `/admin/jobs/${encodeURIComponent(job.id)}`,
    }))

    // Recent activity - get jobs sorted by last run
    const recentActivity = jobs
      .filter(j => j.lastRun)
      .sort((a, b) => {
        const aTime = a.lastRun?.finishedAt ?? a.lastRun?.startedAt ?? ""
        const bTime = b.lastRun?.finishedAt ?? b.lastRun?.startedAt ?? ""
        return bTime.localeCompare(aTime)
      })
      .slice(0, 5)
      .map(job => ({
        jobId: job.id,
        jobName: job.displayName,
        status: formatStatus(job.lastRun?.status),
        statusVariant: job.lastRun?.status === "succeeded" ? "success" :
                       job.lastRun?.status === "failed" ? "destructive" :
                       job.lastRun?.status === "running" ? "default" : "secondary",
        trigger: job.lastRun?.trigger ?? "—",
        duration: formatDuration(job.lastRun?.durationMs),
        time: job.lastRun?.finishedAt
          ? new Date(job.lastRun.finishedAt).toLocaleTimeString()
          : job.lastRun?.startedAt
            ? new Date(job.lastRun.startedAt).toLocaleTimeString()
            : "—",
      }))

    return {
      stats: {
        total: totalJobs,
        running: runningJobs,
        enabled: enabledJobs,
        cron: cronJobs,
      },
      jobRows,
      recentActivity,
      hasJobs: jobs.length > 0,
    }
  },
  layout: (data) => {
    return [
      Layouts.rows([
        Layouts.header({
          title: "Jobs",
          subtitle: "Manage background jobs and view run history.",
          requiredIntent: "jobs.manage",
        }),
        Layouts.columns([
          {
            span: 3,
            nodes: [
              Layouts.card({
                title: "Total Jobs",
                description: "Registered job definitions",
                nodes: [
                  Layouts.text({ valueKey: "stats.total" }),
                ],
              }),
            ],
          },
          {
            span: 3,
            nodes: [
              Layouts.card({
                title: "Running",
                description: "Currently executing",
                nodes: [
                  Layouts.text({ valueKey: "stats.running" }),
                ],
              }),
            ],
          },
          {
            span: 3,
            nodes: [
              Layouts.card({
                title: "Enabled",
                description: "Jobs with active triggers",
                nodes: [
                  Layouts.text({ valueKey: "stats.enabled" }),
                ],
              }),
            ],
          },
          {
            span: 3,
            nodes: [
              Layouts.card({
                title: "Scheduled",
                description: "With cron triggers",
                nodes: [
                  Layouts.text({ valueKey: "stats.cron" }),
                ],
              }),
            ],
          },
        ]),
        Layouts.card({
          title: "All Jobs",
          description: "Click a job to view details and run history.",
          nodes: [
            Layouts.table({
              key: "jobs-table",
              rowsKey: "jobRows",
              columns: [
                {
                  key: "displayName",
                  label: "Job",
                  render: "link",
                  linkKey: "_link",
                },
                { key: "namespace", label: "Namespace" },
                {
                  key: "status",
                  label: "Status",
                  render: "badge",
                  badgeVariantKey: "statusVariant",
                },
                {
                  key: "lastStatus",
                  label: "Last Run",
                  render: "badge",
                  badgeVariantKey: "lastStatusVariant",
                },
                { key: "totalRuns", label: "Runs" },
                { key: "triggers", label: "Triggers" },
              ],
              searchable: true,
              searchPlaceholder: "Search jobs...",
            }),
          ],
        }),
        Layouts.card({
          title: "Recent Activity",
          description: "Latest job run results.",
          nodes: [
            Layouts.table({
              key: "recent-activity",
              rowsKey: "recentActivity",
              columns: [
                { key: "jobName", label: "Job" },
                {
                  key: "status",
                  label: "Status",
                  render: "badge",
                  badgeVariantKey: "statusVariant",
                },
                { key: "trigger", label: "Trigger" },
                { key: "duration", label: "Duration" },
                { key: "time", label: "Time" },
              ],
              searchable: false,
            }),
          ],
        }),
      ]),
    ]
  },
}

export default panel
