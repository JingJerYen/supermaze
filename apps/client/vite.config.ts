import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves the site under /<repo>/; the workflow sets BASE_PATH accordingly.
  base: process.env.BASE_PATH ?? "/",
  server: {
    host: true,
    port: 5173,
  },
});
