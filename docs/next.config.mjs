import { createMDX } from "fumadocs-mdx/next";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
const withMDX = createMDX({
  configPath: fileURLToPath(new URL("./source.config.ts", import.meta.url)),
  outDir: fileURLToPath(new URL("./.source", import.meta.url)),
});

/** @type {import('next').NextConfig} */
const config = {
  serverExternalPackages: ["@takumi-rs/image-response"],
  reactStrictMode: true,
  turbopack: {
    root: workspaceRoot,
  },
  async rewrites() {
    return [
      {
        source: "/docs/:path*.mdx",
        destination: "/llms.mdx/docs/:path*",
      },
    ];
  },
};

export default withMDX(config);
