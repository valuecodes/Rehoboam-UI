import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const cloudflareAnalytics = (): Plugin => ({
  name: "cloudflare-analytics",
  transformIndexHtml: {
    order: "post",
    handler: (_, ctx) =>
      ctx.bundle
        ? [
            {
              tag: "script",
              attrs: {
                defer: true,
                src: "https://static.cloudflareinsights.com/beacon.min.js",
                "data-cf-beacon":
                  '{"token": "bbaf80d9d8b444be9802b588ab2bddef"}',
              },
              injectTo: "body",
            },
          ]
        : [],
  },
});

export default defineConfig({
  plugins: [react(), cloudflareAnalytics()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
