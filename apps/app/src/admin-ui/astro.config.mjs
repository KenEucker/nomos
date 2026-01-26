import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import tailwind from "@astrojs/tailwind";
import node from "@astrojs/node";
import { pluginPages } from "./src/integrations/plugin-pages.js";

const astroDevPort = process.env.ASTRO_DEV_PORT ? parseInt(process.env.ASTRO_DEV_PORT, 10) : 4321;
// When running as middleware behind a proxy, HMR WebSocket connections don't work
// because the main app's proxy doesn't handle WebSocket upgrades.
// Disable HMR to prevent connection errors in the browser console.
const isMiddlewareMode = process.env.ASTRO_MIDDLEWARE_MODE === "true";

export default defineConfig({
  integrations: [
    svelte(),
    tailwind({ applyBaseStyles: false }),
    // Using Astro's native View Transitions instead of Swup
    // View Transitions work better with Astro's island hydration and Svelte 5 runes
    pluginPages()
  ],
  output: "server",
  base: "/admin",
  extends: "astro/tsconfigs/strict",
  adapter: node({ mode: "middleware" }),
  vite: {
    server: {
      hmr: isMiddlewareMode ? false : {
        port: astroDevPort
      }
    }
  }
});
