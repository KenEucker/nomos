import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import tailwind from "@astrojs/tailwind";
import node from "@astrojs/node";
import swup from "@swup/astro";
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
    // Swup temporarily disabled due to compatibility issues with Svelte 5's effect system
    // When Astro hydrates islands after Swup navigation, bits-ui and svelte-sonner
    // components fail with "effect_orphan" errors because their internal $effect
    // calls happen outside of Svelte's effect context.
    // TODO: Re-enable once @astrojs/svelte properly supports Svelte 5 runes in hydration
    // swup({
    //   globalInstance: true,
    //   containers: ["#swup"],
    //   animationSelector: "#swup",
    //   linkSelector: 'a[href^="/admin"]'
    // }),
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
