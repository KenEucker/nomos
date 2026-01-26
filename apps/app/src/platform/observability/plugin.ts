import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  name: "observability",
  intents: ["admin.read", "admin.write"],
  routes: [
    {
      baseDir: path.join(__dirname, "routes"),
      owner: "observability"
    }
  ]
};
