import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../.."
  ),
  server: {
    port: 5173,
  },
});