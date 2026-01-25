import { nanoid } from "nanoid";
import type { JobsRuntime } from "../jobs/runtime";
import type { EventBus } from "../events/bus";
import type { WebhookDestination, WebhookDelivery } from "./types";
import { buildSignature } from "./signing";
import type { AppLogger } from "../logging/logger";

export class WebhookRuntime {
  constructor(
    private jobs: JobsRuntime | null,
    private events: EventBus,
    private store: { destinations: Map<string, WebhookDestination>; deliveries: WebhookDelivery[] },
    private log: AppLogger
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

      // Webhook delivery is now handled via the new jobs system
      // The job is discovered from platform/webhooks/jobs/deliver-webhook.ts
      // Job ID will be: webhooks.deliver-webhook (namespace + filename)
      if (this.jobs) {
        this.jobs.enqueue("webhooks.deliver-webhook", "event", {
          triggerPayload: {
            delivery,
            destination, // Pass destination so job can deliver without accessing runtime
          },
        }).catch((err) => {
          this.log.error({ err, deliveryId: delivery.id }, "Failed to enqueue webhook delivery job");
          // Remove the delivery from the in-memory store since enqueue failed
          // This prevents leaving a queued-but-unprocessable delivery
          const index = this.store.deliveries.findIndex((d) => d.id === delivery.id);
          if (index !== -1) {
            this.store.deliveries.splice(index, 1);
            this.log.debug({ deliveryId: delivery.id }, "Removed delivery from store after enqueue failure");
          }
        });
      }
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
