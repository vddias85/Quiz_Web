import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testes que usam o banco do .env.local (sempre o dev; o setup recusa o prod).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/integration/setup.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
