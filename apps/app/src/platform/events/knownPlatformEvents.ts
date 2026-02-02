/**
 * Event types the platform can emit. Used so consumers can list all subscribable
 * events, not only those that currently have listeners or are declared in plugin manifests.
 */
import { JOB_EVENTS } from "../jobs/types";

const jobEvents = (Object.values(JOB_EVENTS) as string[]).map(
  (e) => `jobs.${e.toLowerCase()}`
);

export const KNOWN_PLATFORM_EVENTS: string[] = [
  "audit.recorded",
  "http.request.completed",
  "observability.events_pruned",
  ...jobEvents,
];
