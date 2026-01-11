import { nanoid } from "nanoid";
import type { Logger } from "pino";
import type { JobsRuntime } from "../jobs/runtime.js";
import type { EventBus } from "../events/bus.js";
import type { WebhookDestination, WebhookDelivery } from "./types.js";
import { buildSignature } from "./signing.js";

export class WebhookRuntime {
  constructor(
    private jobs: JobsRuntime,
    private events: EventBus,
    private store: { destinations: Map<string, WebhookDestination>; deliveries: WebhookDelivery[] },
    private log: Logger
  ) {}

  listDestinations() {
    return Array.from(this.store.destinations.values());
  }

  addDestination(destination: Omit<WebhookDestination, "id">) {
    const entry = { ...destination, id: nanoid() };
    this.store.destinations.set(entry.id, entry);
    return entry;
  }

  enqueue(event: string, payload: any) {
    for (const destination of this.store.destinations.values()) {
      if (!destination.events.includes(event)) continue;
      const delivery: WebhookDelivery = {
        id: nanoid(),
        destinationId: destination.id,
        event,
        payload,
        status: "queued",
        createdAt: new Date().toISOString()
      };
      this.log.debug({ deliveryId: delivery.id, destinationId: destination.id, event }, "Webhook queued.");
      this.store.deliveries.push(delivery);
      this.jobs.dispatch("platform.webhook.delivery", delivery, {
        attempts: destination.retryPolicy?.attempts ?? 3,
        delayMs: destination.retryPolicy?.delayMs ?? 0
      });
    }
  }

  async deliver(delivery: WebhookDelivery) {
    const destination = this.store.destinations.get(delivery.destinationId);
    if (!destination) return;
    const log = this.log.child({ deliveryId: delivery.id, destinationId: destination.id });
    const payload = JSON.stringify({ event: delivery.event, payload: delivery.payload });
    const { signature, timestamp } = buildSignature(destination.secret, payload);
    try {
      const response = await fetch(destination.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signature,
          "X-Signature-Timestamp": timestamp,
          ...(destination.headers ?? {})
        },
        body: payload
      });
      delivery.status = response.ok ? "delivered" : "failed";
      delivery.responseStatus = response.status;
      log.info({ status: delivery.status, responseStatus: response.status }, "Webhook delivered.");
      if (!response.ok) {
        delivery.error = `HTTP ${response.status}`;
      }
      this.events.emit("webhooks.delivered", {
        deliveryId: delivery.id,
        destinationId: destination.id,
        status: delivery.status
      });
    } catch (error) {
      delivery.status = "failed";
      delivery.error = (error as Error).message;
      log.error({ err: error }, "Webhook delivery failed.");
      this.events.emit("webhooks.failed", {
        deliveryId: delivery.id,
        destinationId: destination.id,
        error: delivery.error
      });
    }
  }
}
