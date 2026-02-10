import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is the default bundler in Next.js 16+
  // Empty turbopack config signals we're OK with defaults
  turbopack: {},

  // Webpack config for non-Turbopack builds (e.g. production)
  // Tesseract.js compatibility: resolve canvas and encoding aliases
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
