import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_SUPABASE_URL || "https://gglsmwtyrwadwxyvevmr.supabase.co";
  const anonKey = env.VITE_SUPABASE_ANON_KEY || "";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      open: false,
      proxy: {
        "/api/v1": {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/v1/, ""),
          headers: {
            apikey: anonKey,
            authorization: `Bearer ${anonKey}`,
          },
          configure: (proxy) => {
            proxy.on("proxyRes", (proxyRes) => {
              // Strip vendor and internal headers to avoid exposing backend service
              delete proxyRes.headers["sb-project-ref"];
              delete proxyRes.headers["sb-gateway-version"];
              delete proxyRes.headers["sb-jwt-alg"];
              delete proxyRes.headers["sb-jwt-iss"];
              delete proxyRes.headers["sb-request-id"];
              delete proxyRes.headers["set-cookie"];
              delete proxyRes.headers["server"];
              delete proxyRes.headers["content-location"];
              delete proxyRes.headers["alt-svc"];
            });
          },
        },
      },
    },
    preview: {
      proxy: {
        "/api/v1": {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/v1/, ""),
          headers: {
            apikey: anonKey,
            authorization: `Bearer ${anonKey}`,
          },
          configure: (proxy) => {
            proxy.on("proxyRes", (proxyRes) => {
              delete proxyRes.headers["sb-project-ref"];
              delete proxyRes.headers["sb-gateway-version"];
              delete proxyRes.headers["sb-jwt-alg"];
              delete proxyRes.headers["sb-jwt-iss"];
              delete proxyRes.headers["sb-request-id"];
              delete proxyRes.headers["set-cookie"];
              delete proxyRes.headers["server"];
              delete proxyRes.headers["content-location"];
              delete proxyRes.headers["alt-svc"];
            });
          },
        },
      },
    },
  };
});
