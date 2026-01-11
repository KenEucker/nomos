import { nanoid } from "nanoid";
import { runHooks } from "../../../platform/events/hooks.js";

export function createUsersService(db: any, hooks: any, events: any) {
  return {
    list() {
      return Array.from(db.users.values());
    },
    get(id: string) {
      return db.users.get(id) ?? null;
    },
    async create(data: any) {
      await runHooks(hooks, "beforeCreate", "users", data);
      const entry = { id: nanoid(), ...data };
      db.users.set(entry.id, entry);
      await runHooks(hooks, "afterCreate", "users", entry);
      await events.emit("users.created", entry);
      return entry;
    },
    async update(id: string, data: any) {
      await runHooks(hooks, "beforeUpdate", "users", { id, ...data });
      const entry = db.users.get(id);
      if (!entry) return null;
      Object.assign(entry, data);
      await runHooks(hooks, "afterUpdate", "users", entry);
      await events.emit("users.updated", entry);
      return entry;
    },
    async remove(id: string) {
      await runHooks(hooks, "beforeDelete", "users", { id });
      const entry = db.users.get(id);
      if (!entry) return null;
      db.users.delete(id);
      await runHooks(hooks, "afterDelete", "users", entry);
      await events.emit("users.deleted", entry);
      return entry;
    }
  };
}
