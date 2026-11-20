import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // JSX con el runtime automático de React, como en la app.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // server-only lanza error fuera de Next; en pruebas no hace falta el guardia.
      "server-only": path.resolve(__dirname, "tests/support/server-only-stub.ts"),
    },
  },
  test: { include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"], environment: "node" },
});
