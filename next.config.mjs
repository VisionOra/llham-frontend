/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://192.168.1.105:8000/api/:path*',
      },
      {
        source: '/projects/:path*',
        destination: 'http://192.168.1.105:8000/projects/:path*',
      },
      {
        source: '/projects',
        destination: 'http://192.168.1.105:8000/projects/',
      },
    ];
  },
}

export default nextConfig
