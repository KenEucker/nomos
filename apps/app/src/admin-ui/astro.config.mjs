import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import node from "@astrojs/node";

export default defineConfig({
  integrations: [svelte()],
  output: "server",
  adapter: node({ mode: "middleware" }),
  base: "/admin"
});
