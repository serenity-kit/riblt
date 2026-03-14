import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/server.ts"],
    clean: true,
    dts: false,
    format: ["esm"],
    outDir: "dist",
    platform: "node",
    sourcemap: true,
    target: "es2022",
  },
  {
    entry: ["src/client.ts"],
    clean: false,
    dts: false,
    format: ["esm"],
    noExternal: ["@riblt/setsync", "riblt"],
    outDir: "dist",
    platform: "browser",
    sourcemap: true,
    target: "es2022",
  },
]);
