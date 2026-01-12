import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import tailwind from "@astrojs/tailwind";
import node from "@astrojs/node";

const astroDevPort = process.env.ASTRO_DEV_PORT ? parseInt(process.env.ASTRO_DEV_PORT, 10) : 4321;

export default defineConfig({
  integrations: [svelte(), tailwind({ applyBaseStyles: false })],
  output: "server",
  adapter: node({ mode: "middleware" }),
  vite: {
    server: {
      hmr: {
        port: astroDevPort
      }
    }
  }
});
