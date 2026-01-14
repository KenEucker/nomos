import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCorePageRoutes, getPluginPageRoutes } from "../src/integrations/plugin-pages.js";

const adminUiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const [{ routes: pluginRoutes }, { routes: coreRoutes }] = await Promise.all([
  getPluginPageRoutes({ adminUiRoot }),
  getCorePageRoutes({ adminUiRoot })
]);

const expectedRoutes = ["/plugin-pages", "/plugin-pages/[id]", "/plugin-pages/nested"];
const missing = expectedRoutes.filter(
  (route) => !pluginRoutes.some((pluginRoute) => pluginRoute.route === route)
);

if (missing.length > 0) {
  console.error("Missing expected plugin page routes:");
  for (const route of missing) {
    console.error(`- ${route}`);
  }
  process.exit(1);
}

const coreRouteSet = new Set(coreRoutes.map((route) => route.route));
const collisions = pluginRoutes.filter((route) => coreRouteSet.has(route.route));

if (collisions.length > 0) {
  console.error("Plugin routes collide with core routes:");
  for (const route of collisions) {
    console.error(`- ${route.route}`);
  }
  process.exit(1);
}

console.log("Plugin page routes discovered successfully.");
