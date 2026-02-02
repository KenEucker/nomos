import { createApiKey, rotateApiKey, revokeApiKey, findApiKey } from "./apiKeys";

export default {
  name: "auth",
  intents: ["auth.manage"],
  services: {
    auth: (db: any) => {
      const store = db.prisma ?? db.apiKeys;
      if (store == null) {
        throw new Error("Auth store missing: expected db.prisma or db.apiKeys");
      }
      return {
        createApiKey(payload: any) {
          return createApiKey(store, payload);
        },
        rotateApiKey(id: string) {
          return rotateApiKey(store, id);
        },
        revokeApiKey(id: string) {
          return revokeApiKey(store, id);
        },
        findApiKey(token: string) {
          return findApiKey(store, token);
        },
      };
    },
  },
};
