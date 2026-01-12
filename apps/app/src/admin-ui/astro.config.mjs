import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import tailwind from "@astrojs/tailwind";
import node from "@astrojs/node";

export default defineConfig({
  integrations: [svelte(), tailwind({ applyBaseStyles: false })],
  output: "server",
  adapter: node({ mode: "middleware" }),
  vite: {
    server: {
      hmr: {
        port: 4321
      }
    }
  }
});
