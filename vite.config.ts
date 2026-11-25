import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import vitePluginMonkey from "vite-plugin-monkey";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    minify: true,
  },
  plugins: [
    react(),
    vitePluginMonkey({
      entry: "src/userscript.tsx",
      userscript: {
        namespace: "https://github.com/sqzw-x",
        match: ["https://*/*", "http://*/*"],
        connect: ["*"],
      },
      build: {
        externalGlobals: {},
      },
      server: {},
    }),
  ],
});
