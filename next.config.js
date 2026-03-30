/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  trailingSlash: false,
  // Ensure native modules are bundled for serverless (Netlify)
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],
}

module.exports = nextConfig
