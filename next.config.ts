import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    commitTag: process.env.COMMIT_TAG || 'local',
    // Phase 6: Disable Next.js telemetry at build time
    NEXT_TELEMETRY_DISABLED: '1',
  },
  images: {
    remotePatterns: [
      { hostname: 'gravatar.com' },
      { hostname: 'image.tmdb.org' },
      { hostname: 'artworks.thetvdb.com' },
      { hostname: 'plex.tv' },
    ],
  },
  transpilePackages: ['country-flag-icons'],
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  experimental: {
    scrollRestoration: true,
    largePageDataBytes: 512 * 1000,
  },
  // Phase 6: Disable powered-by header and add security headers
  poweredByHeader: false,
};

export default nextConfig;
