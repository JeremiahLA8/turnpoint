import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// Supabase project ID baked into the SW route matchers so we only intercept
// our own project's requests, not any third party with a similar URL shape.
// Keep in sync with src/integrations/supabase/client.ts.
// (Inlined into the RegExps below — Workbox's generateSW mode serializes the
// SW statically and arrow-function closures over outer variables get lost.)

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Turnpoint",
        short_name: "Turnpoint",
        description: "STR cleaning turnover operations",
        theme_color: "#e6692b",
        background_color: "#fefcfa",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache built app shell so first paint works offline.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        globIgnores: ["**/placeholder.svg"],
        // SPA fallback for deep links opened with no network.
        navigateFallback: "/index.html",
        // Don't let the SW navigation-fallback intercept auth or edge calls —
        // those should fail fast offline so the client surfaces the error.
        navigateFallbackDenylist: [/^\/api/, /\/auth\/v1\//, /\/functions\/v1\//],
        runtimeCaching: [
          {
            // Supabase REST (PostgREST) — NetworkFirst with a 5s timeout so
            // online users always get fresh data, offline users get cached.
            urlPattern: /^https:\/\/your-project-ref\.supabase\.co\/rest\/v1\//,
            handler: "NetworkFirst",
            method: "GET",
            options: {
              cacheName: "supabase-rest",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Storage signed URLs (job photos). Stale-while-revalidate so
            // thumbnails appear instantly and refresh in the background.
            urlPattern: /^https:\/\/your-project-ref\.supabase\.co\/storage\/v1\/object\//,
            handler: "StaleWhileRevalidate",
            method: "GET",
            options: {
              cacheName: "supabase-storage",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Disable in dev so HMR isn't fighting the service worker. Verify via
      // `npm run build && npm run preview`.
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
