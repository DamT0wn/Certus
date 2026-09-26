import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": loadEnv(mode, process.cwd(), "").API_PROXY_TARGET || "http://localhost:5000",
    },
  },
}));
