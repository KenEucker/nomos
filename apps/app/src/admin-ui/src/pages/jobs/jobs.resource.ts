import { createResourceDefinition } from "../../lib/utils";

export const jobsResource = createResourceDefinition({
  name: "jobs",
  label: "Job",
  labelPlural: "Jobs",
  menu: {
    group: "System",
    icon:
      '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  },
  endpoints: {
    list: "/_/jobs",
  },
  dataKey: "jobs",
  list: {
    searchable: true,
    searchPlaceholder: "Search jobs...",
    columns: [
      { key: "id", label: "Job ID", sortable: true },
      { key: "queue", label: "Queue", hideOnMobile: true },
      { key: "concurrency", label: "Concurrency", hideOnMobile: true },
      { key: "retries", label: "Retries", hideOnMobile: true },
      { key: "schedule", label: "Schedule", hideOnMobile: true },
    ],
  },
  intents: {
    read: "admin.access",
  },
});
