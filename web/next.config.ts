import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', 'bullmq', 'ioredis', '@ioredis/client'],
};

export default config;
