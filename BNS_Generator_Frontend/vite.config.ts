import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,

    // ---- Proxy ONLY predict ----
    proxy: {
      "/predict": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
      "/predict_verbose": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
    // -----------------------------
  },

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
