import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      proxy: {
        "/api/auth": {
          target: env.AUTH_SERVICE_TARGET || "http://localhost:5000",
          changeOrigin: true,
        },
        "/api/libraries": {
          target: env.LIBRARY_SERVICE_TARGET || "http://localhost:5001",
          changeOrigin: true,
        },
        "/api/network": {
          target: env.NETWORK_SERVICE_TARGET || "http://localhost:5002",
          changeOrigin: true,
        },
        "/api/chat": {
          target: env.CHAT_SERVICE_TARGET || "http://localhost:5003",
          changeOrigin: true,
        },
        "/socket.io": {
          target: env.CHAT_SERVICE_TARGET || "http://localhost:5003",
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
