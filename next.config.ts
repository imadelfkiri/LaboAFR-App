import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'onnxruntime-node'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Désactiver le cache pour les environnements de développement qui ont des problèmes de chargement de chunk
      if (process.env.NODE_ENV === 'development') {
        config.cache = false;
      }
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
    ],
  },
};

export default nextConfig;
