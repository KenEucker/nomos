import type { AppLogger } from "../logging/logger";

export type EventMeta = {
  event: string;
  timestamp: string;
  log?: AppLogger;
};

export type EventHandler = (payload: any, meta: EventMeta) => Promise<void> | void;

export type EventListener = {
  event: string;
  handler: EventHandler;
  mode?: "bestEffort" | "failFast";
};

export type HookHandler = (payload: any) => Promise<void> | void;
