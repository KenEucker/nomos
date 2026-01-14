import type { Ctx } from "../../../../ctx";

export const config = {
  auth: "required",
  permissions: ["webhooks.manage"],
  tags: ["admin"],
  summary: "List available webhook events"
};

const formatName = (event: string) => {
  return event
    .split(".")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
};

export const get = async (ctx: Ctx) => {
  const pluginEvents = Array.from(ctx.services.pluginRegistry.events ?? []);
  const listenerEvents = ctx.events.listEvents();
  const unique = new Set([...pluginEvents, ...listenerEvents]);
  const events = Array.from(unique)
    .sort()
    .map((event) => ({ key: event, name: formatName(event as string) }));
  return ctx.json({ events });
};
