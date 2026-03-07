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
                  '{"token": "caa6f78379254d678e20950e5b7d9bbc"}',
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
