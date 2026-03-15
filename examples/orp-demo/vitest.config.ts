import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      riblt: resolve(rootDir, "../../packages/riblt/src/index.ts"),
      "@riblt/orp": resolve(rootDir, "../../packages/orp/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.test.ts"],
  },
});
