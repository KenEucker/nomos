/**
 * Webhook Delivery Logic
 *
 * Standalone function for delivering webhooks that can be called
 * from both the main thread and worker threads.
 */

import { buildSignature } from "./signing";
import type { WebhookDestination, WebhookDelivery } from "./types";

export interface WebhookDeliveryPayload {
  delivery: WebhookDelivery;
  destination: WebhookDestination;
}

/**
 * Deliver a webhook to a destination
 * This function can be called from worker threads
 */
export async function deliverWebhook(
  payload: WebhookDeliveryPayload
): Promise<{ success: boolean; status: number; error?: string }> {
  const { delivery, destination } = payload;

  const body = JSON.stringify({ event: delivery.event, payload: delivery.payload });
  const { signature, timestamp } = buildSignature(destination.secret, body);

  try {
    const response = await fetch(destination.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signature,
        "X-Signature-Timestamp": timestamp,
        ...(destination.headers ?? {}),
      },
      body,
    });

    return {
      success: response.ok,
      status: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
