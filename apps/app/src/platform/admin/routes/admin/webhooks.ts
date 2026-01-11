export const config = {
  auth: "required",
  permissions: ["webhooks.manage"],
  tags: ["admin"],
  summary: "Webhook destinations"
};

import type { Ctx } from "../../../ctx.js";

export const get = async (ctx: Ctx) => {
  return ctx.json({ destinations: ctx.webhooks.listDestinations(), deliveries: ctx.db.webhookDeliveries });
};

export const post = async (ctx: Ctx) => {
  const destination = ctx.webhooks.addDestination(ctx.body);
  return ctx.json(destination, 201);
};
