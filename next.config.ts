import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverComponentsExternalPackages: [],
  },
  webpack: (config, { isServer, dev }) => {
    if (dev && !isServer) {
      // Merge all runtime chunks into a single chunk.
      // This is a robust solution to prevent ChunkLoadError in some development environments.
      config.optimization.runtimeChunk = 'single';
    }
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
