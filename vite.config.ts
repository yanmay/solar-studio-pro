import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = env.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL;

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: apiBaseUrl ? {
        '/api': {
          target: apiBaseUrl,
          changeOrigin: true,
        }
      } : undefined
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      {
        name: "api-server-middleware",
        configureServer(server) {
          if (!apiBaseUrl) {
            const rawServer = server.httpServer;
            if (rawServer) {
              rawServer.once("listening", () => {
                const listeners = [...rawServer.listeners("request")];
                rawServer.removeAllListeners("request");

                rawServer.on("request", (req: any, res: any) => {
                  const url = req.url || "";
                  if (url.startsWith("/api")) {
                    import("module")
                      .then(({ createRequire }) => {
                        const requireCjs = createRequire(import.meta.url);
                        try {
                          const resolved = requireCjs.resolve("./api-server.cjs");
                          delete requireCjs.cache[resolved];
                        } catch (e) {}
                        const { handleRequest } = requireCjs("./api-server.cjs");
                        handleRequest(req, res).catch((err) => {
                          console.error("[VITE API ERROR]:", err);
                          if (!res.headersSent) {
                            res.writeHead(500, { "Content-Type": "application/json" });
                            res.end(JSON.stringify({ error: "Internal Server Error", details: err.message }));
                          }
                        });
                      })
                      .catch((err) => {
                        console.error("[VITE API LOAD ERROR]:", err);
                        if (!res.headersSent) {
                          res.writeHead(500, { "Content-Type": "application/json" });
                          res.end(JSON.stringify({ error: "Failed to load API server", details: err.message }));
                        }
                      });
                  } else {
                    for (const listener of listeners) {
                      listener(req, res);
                    }
                  }
                });
              });
            }
          }
        }
      }
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
