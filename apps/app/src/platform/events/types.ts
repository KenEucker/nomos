export type EventHandler = (payload: any, meta: { event: string; timestamp: string }) => Promise<void> | void;

export type EventListener = {
  event: string;
  handler: EventHandler;
  mode?: "bestEffort" | "failFast";
};

export type HookHandler = (payload: any) => Promise<void> | void;
