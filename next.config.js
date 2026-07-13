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
  // Baseline security headers. Deliberately conservative — no CSP (would need
  // per-route testing against Next's inline scripts) and no Permissions-Policy
  // (avoid breaking features). X-Frame-Options matters here: the dashboard has
  // an admin impersonation UI that must not be framed/clickjacked.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
