import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  target: "es2022",
  platform: "node",
  noExternal: ["@riblt/orp", "riblt"],
});
