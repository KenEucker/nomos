import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApiKey, rotateApiKey, revokeApiKey, findApiKey } from "./apiKeys.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  name: "auth",
  permissions: ["auth.manage"],
  routes: [
    {
      baseDir: path.join(__dirname, "routes"),
      owner: "auth"
    }
  ],
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
