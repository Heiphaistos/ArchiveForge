import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
  },
  serverExternalPackages: ['better-sqlite3'],
};

export default config;
