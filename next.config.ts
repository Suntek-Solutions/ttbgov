import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is the default bundler in Next.js 16+
  turbopack: {},

  // Tesseract.js + sharp must be resolved from node_modules at runtime,
  // not bundled by Turbopack (worker threads break otherwise)
  serverExternalPackages: ["tesseract.js", "sharp"],

  // Webpack config for non-Turbopack builds (e.g. production)
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      encoding: false,
    };
    return config;
  },

  // Allow larger API request bodies for image uploads (10MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
