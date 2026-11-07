import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  envDir: "../../",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "FinanceApp",
        short_name: "Finance",
        description: "Live monthly expense tracking for cash, UPI, and cards.",
        theme_color: "#07090d",
        background_color: "#07090d",
        display: "standalone",
        start_url: "/",
        shortcuts: [
          {
            name: "Add expense by voice",
            short_name: "Voice",
            url: "/?action=voice",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }],
          },
        ],
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^https:\/\/(api\.fontshare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)/,
            handler: "CacheFirst",
            options: {
              cacheName: "fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
