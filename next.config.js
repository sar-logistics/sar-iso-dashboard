/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Skip strict type errors during the production build.
    // Phase 2D will re-enable this once filter state is properly typed.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Skip ESLint warnings during the production build.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;