import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "nepse-bot-fe",
  envDir: path.resolve(__dirname),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./nepse-bot-fe/src"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
