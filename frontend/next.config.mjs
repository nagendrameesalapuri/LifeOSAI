/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  logging: {
    fetches: { fullUrl: false },
  },
};

export default nextConfig;
