import type { HookHandler } from "./types";

export type HookRegistry = {
  beforeCreate: Map<string, HookHandler[]>;
  afterCreate: Map<string, HookHandler[]>;
  beforeUpdate: Map<string, HookHandler[]>;
  afterUpdate: Map<string, HookHandler[]>;
  beforeDelete: Map<string, HookHandler[]>;
  afterDelete: Map<string, HookHandler[]>;
};

export function createHookRegistry(): HookRegistry {
  return {
    beforeCreate: new Map(),
    afterCreate: new Map(),
    beforeUpdate: new Map(),
    afterUpdate: new Map(),
    beforeDelete: new Map(),
    afterDelete: new Map()
  };
}

export function registerHook(
  registry: HookRegistry,
  type: keyof HookRegistry,
  resource: string,
  handler: HookHandler
) {
  const list = registry[type].get(resource) ?? [];
  list.push(handler);
  registry[type].set(resource, list);
}

export async function runHooks(
  registry: HookRegistry,
  type: keyof HookRegistry,
  resource: string,
  payload: any
) {
  const list = registry[type].get(resource) ?? [];
  for (const handler of list) {
    await handler(payload);
  }
}
