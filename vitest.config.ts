import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts"],
    environment: "node",
    // Hermético: los guards de producción leen NODE_ENV; la suite no debe
    // depender del NODE_ENV del shell (p. ej. production en CI/Vercel).
    env: { NODE_ENV: "test" },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
    },
  },
});
