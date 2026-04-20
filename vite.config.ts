import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "earth_day_4k.jpg",
        "earth_night_4k.jpg",
        "earth_clouds_hd.png",
        "earth_specular.jpg",
        "earth_normal.jpg",
        "galaxystarfield.png",
      ],
      manifest: {
        name: "SUNPOWER LINK — Rooftop Solar Analyser",
        short_name: "SUNPOWER LINK",
        description: "AI-powered rooftop solar analysis for India. Estimate kWh, savings, PM Surya Ghar subsidy & CO₂ from a satellite view.",
        theme_color: "#F59E0B",
        background_color: "#0a0a0a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "en-IN",
        categories: ["utilities", "productivity", "lifestyle"],
        icons: [
          { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
        shortcuts: [
          { name: "Analyze a roof", short_name: "Analyze", url: "/map", description: "Open the map and start a new rooftop analysis" },
        ],
      },
      workbox: {
        // Bigger limit so the high-res Earth textures are precached
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,woff2}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(mt[0-3]|services)\.(google|arcgisonline)\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "satellite-tiles",
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "geocoding",
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/photon\.komoot\.io\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "geocoding-photon",
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /^https:\/\/(overpass-api\.de|overpass\.kumi\.systems|overpass\.openstreetmap\.ru)\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "osm-buildings",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/power\.larc\.nasa\.gov\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "nasa-power",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
