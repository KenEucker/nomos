export type WebhookDestination = {
  id: string;
  url: string;
  events: string[];
  secret: string;
  headers?: Record<string, string>;
  retryPolicy?: { attempts: number; delayMs: number };
};

export type WebhookDelivery = {
  id: string;
  destinationId: string;
  event: string;
  payload: any;
  status: "queued" | "delivered" | "failed";
  responseStatus?: number;
  error?: string;
  createdAt: string;
};
