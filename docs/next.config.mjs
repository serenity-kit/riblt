import { createMDX } from 'fumadocs-mdx/next';
import { fileURLToPath } from 'node:url';

const withMDX = createMDX();
const root = fileURLToPath(new URL('./', import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  serverExternalPackages: ['@takumi-rs/image-response'],
  reactStrictMode: true,
  turbopack: {
    root,
  },
  async rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/docs/:path*',
      },
    ];
  },
};

export default withMDX(config);
