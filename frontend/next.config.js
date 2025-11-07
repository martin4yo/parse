/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5100',
  },
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['react', 'react-dom']
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5100'}/api/:path*`
      }
    ]
  }
}

module.exports = nextConfig