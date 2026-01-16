import { apiGet } from "../../lib/api";
import type { ListPageModule } from "../../lib/pages/types";

interface DiagnosticsCoreModule {
  name: string;
  enabled: boolean;
  apiEnabled?: boolean;
  uiEnabled?: boolean;
}

interface DiagnosticsOverview {
  status?: string;
  routes?: number;
  jobs?: number;
  events?: string[];
  coreModules?: DiagnosticsCoreModule[];
}

interface DiagnosticsRoute {
  method: string;
  path: string;
  id: string;
}

interface DiagnosticsJob {
  id: string;
  queue?: string;
  schedule?: string;
}

interface DiagnosticsPayload {
  cards: Array<{ label: string; value: string | number; description?: string }>;
  coreModules: Array<{ name: string; state: string; api: string; ui: string }>;
  routes: DiagnosticsRoute[];
  jobs: DiagnosticsJob[];
  events: Array<{ name: string }>;
}

const diagnosticsModule: ListPageModule<DiagnosticsPayload> = {
  resourceId: "diagnostics",
  view: "List",
  title: "Diagnostics",
  subtitle: "Inspect runtime health and system status.",

  query: {
    list: async () => {
      const [overviewResponse, routesResponse, jobsResponse, eventsResponse] = await Promise.all([
        apiGet<DiagnosticsOverview>("/_/diagnostics"),
        apiGet<{ routes: DiagnosticsRoute[] }>("/_/diagnostics/routes"),
        apiGet<{ jobs: DiagnosticsJob[] }>("/_/diagnostics/jobs"),
        apiGet<{ events: string[] }>("/_/diagnostics/events"),
      ]);

      const overview = overviewResponse.data ?? {};
      const routes = routesResponse.data?.routes ?? [];
      const jobs = jobsResponse.data?.jobs ?? [];
      const events = eventsResponse.data?.events ?? [];

      const cards = [
        {
          label: "Status",
          value: overview.status ?? "Unknown",
          description: "Runtime health",
        },
        {
          label: "Total Routes",
          value: overview.routes ?? routes.length,
          description: "Registered endpoints",
        },
        {
          label: "Registered Jobs",
          value: overview.jobs ?? jobs.length,
          description: "Scheduled workloads",
        },
        {
          label: "Event Types",
          value: overview.events?.length ?? events.length,
          description: "Registered signals",
        },
      ];

      const coreModules = (overview.coreModules ?? []).map((module) => ({
        name: module.name,
        state: module.enabled ? "Enabled" : "Disabled",
        api: module.apiEnabled === undefined ? "-" : module.apiEnabled ? "On" : "Off",
        ui: module.uiEnabled === undefined ? "-" : module.uiEnabled ? "On" : "Off",
      }));

      return {
        items: [
          {
            cards,
            coreModules,
            routes,
            jobs,
            events: events.map((event) => ({ name: event })),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 1,
      };
    },
  },

  list: {
    columns: [
      { key: "name", label: "Module" },
      { key: "state", label: "State", render: "badge", badgeVariants: { Enabled: "success", Disabled: "secondary" } },
      { key: "api", label: "API" },
      { key: "ui", label: "UI" },
    ],
    summaryCards: {
      dataKey: "cards",
      labelKey: "label",
      valueKey: "value",
      descriptionKey: "description",
    },
    sections: [
      {
        id: "core-modules",
        title: "Core Modules",
        description: "Platform modules and their runtime state.",
        dataKey: "coreModules",
        columns: [
          { key: "name", label: "Module" },
          { key: "state", label: "State", render: "badge", badgeVariants: { Enabled: "success", Disabled: "secondary" } },
          { key: "api", label: "API" },
          { key: "ui", label: "UI" },
        ],
        emptyMessage: "No core module data available.",
      },
      {
        id: "routes",
        title: "Routes",
        description: "Registered admin and application endpoints.",
        dataKey: "routes",
        columns: [
          { key: "method", label: "Method" },
          { key: "path", label: "Path" },
          { key: "id", label: "ID" },
        ],
        emptyMessage: "No route data available.",
      },
      {
        id: "jobs",
        title: "Jobs",
        description: "Scheduled jobs configured in this runtime.",
        dataKey: "jobs",
        columns: [
          { key: "id", label: "Job ID" },
          { key: "queue", label: "Queue" },
          { key: "schedule", label: "Schedule" },
        ],
        emptyMessage: "No job data available.",
      },
      {
        id: "events",
        title: "Events",
        description: "Event types the runtime can emit.",
        dataKey: "events",
        columns: [{ key: "name", label: "Event" }],
        emptyMessage: "No event data available.",
      },
    ],
  },

  onError: ({ error }) => {
    const message = error instanceof Error ? error.message : "Unable to load diagnostics.";
    return message.includes("Diagnostics disabled")
      ? "Diagnostics are disabled. Set DIAGNOSTICS_ENABLED=true to enable."
      : "Unable to load diagnostics.";
  },

  onSuccess: () => "Diagnostics loaded.",
};

export default diagnosticsModule;
