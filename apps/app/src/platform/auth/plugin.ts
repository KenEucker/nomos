import { createApiKey, rotateApiKey, revokeApiKey, findApiKey } from "./apiKeys";

export default {
  name: "auth",
  intents: ["auth.manage"],
  services: {
    auth: (db: any) => ({
      createApiKey(payload: any) {
        return createApiKey(db.apiKeys, payload);
      },
      rotateApiKey(id: string) {
        return rotateApiKey(db.apiKeys, id);
      },
      revokeApiKey(id: string) {
        return revokeApiKey(db.apiKeys, id);
      },
      findApiKey(token: string) {
        return findApiKey(db.apiKeys, token);
      }
    })
  }
};
