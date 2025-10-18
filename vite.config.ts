import path from "node:path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    minify: true,
  },
  plugins: [
    react(),
    monkey({
      entry: "src/userscript.tsx",
      userscript: {
        name: "CF2 离线下载助手",
        namespace: "https://example.com/your-namespace",
        version: "0.1.0",
        description: "Your userscript description here",
        author: "You",
        match: ["https://*/*", "http://*/*"],
        connect: ["*"],
      },
      build: {
        fileName: "userscript.user.js",
        externalGlobals: {
          // antd: cdn.npmmirror("antd", "dist/antd.min.js"),
        },
        // Always generate sourcemap for easier debug (can be toggled off in release)
      },
      server: {
        // mountGmApi: true,
      },
    }),
  ],
});
