/**
 * Webhook Delivery Job
 *
 * Core platform job that delivers webhooks to configured destinations.
 * Triggered by events when webhook destinations are configured.
 */

import type { JobDefinition } from "../../jobs/types";
import { deliverWebhook, type WebhookDeliveryPayload } from "../delivery";

const job: JobDefinition = {
  description: "Delivers webhook payloads to configured destinations",

  triggers: {
    // This job is triggered by events from WebhookRuntime.enqueue()
    events: [
      { type: "webhooks.deliver" },
    ],
    // Also allow manual execution for retries
    manual: {
      enabled: true,
      permission: "admin.access",
    },
  },

  execution: {
    timeoutMs: 30 * 1000, // 30 seconds
    cancelGraceMs: 5000,
    maxConcurrency: 10, // Allow multiple webhook deliveries in parallel
  },

  runner: {
    isolation: "thread",
  },

  observability: {
    eventPrefix: "webhooks.delivery",
  },

  ui: {
    category: "System",
    hidden: true, // Hide from UI since it's an internal job
  },

  async handler(ctx) {
    // The triggerPayload should contain WebhookDeliveryPayload with both delivery and destination
    const payload = ctx.triggerPayload as WebhookDeliveryPayload | undefined;

    if (!payload || !payload.delivery || !payload.destination) {
      ctx.log("error", "Webhook delivery job called without required payload", {
        runId: ctx.runId,
        hasPayload: !!payload,
        hasDelivery: !!payload?.delivery,
        hasDestination: !!payload?.destination,
      });
      return;
    }

    const { delivery, destination } = payload;

    ctx.log("info", "Starting webhook delivery", {
      deliveryId: delivery.id,
      destinationId: destination.id,
      event: delivery.event,
    });

    try {
      const result = await deliverWebhook(payload);

      if (result.success) {
        ctx.log("info", "Webhook delivered successfully", {
          deliveryId: delivery.id,
          status: result.status,
        });
        ctx.emitEvent("webhooks.delivered", {
          deliveryId: delivery.id,
          destinationId: destination.id,
          status: "delivered",
          responseStatus: result.status,
        });
      } else {
        ctx.log("error", "Webhook delivery failed", {
          deliveryId: delivery.id,
          status: result.status,
          error: result.error,
        });
        ctx.emitEvent("webhooks.failed", {
          deliveryId: delivery.id,
          destinationId: destination.id,
          error: result.error,
        });
        throw new Error(result.error ?? "Webhook delivery failed");
      }
    } catch (error) {
      ctx.log("error", "Webhook delivery exception", {
        deliveryId: delivery.id,
        error: error instanceof Error ? error.message : String(error),
      });
      ctx.emitEvent("webhooks.failed", {
        deliveryId: delivery.id,
        destinationId: destination.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};

export default job;
