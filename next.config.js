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
  // Next 14 exposes this option under `experimental`; the top-level name is a
  // Next 15 option and was silently ignored by this app's current runtime.
  experimental: {
    serverComponentsExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],
  },
  // Baseline security headers. Deliberately conservative — no CSP (would need
  // per-route testing against Next's inline scripts) and no Permissions-Policy
  // (avoid breaking features). X-Frame-Options matters here: the dashboard has
  // an admin impersonation UI that must not be framed/clickjacked.
  // The business portal collapsed from nine nav items to four (Home /
  // My Business / Grow / Materials). These keep every old bookmark, email
  // link, and in-app deep link alive instead of 404ing.
  //   /portal/clients   → Grow, Customers section (the 100 list)
  //   /portal/network   → Grow, Network section
  //   /portal/activity  → Home (the timeline moved there)
  //   /portal/templates → Materials, Template library tab
  // `/portal/setup` deliberately still resolves: it is the first-run wizard,
  // reached from Home rather than the nav.
  async redirects() {
    return [
      { source: '/portal/clients', destination: '/portal/grow?section=customers', permanent: false },
      { source: '/portal/clients/:path*', destination: '/portal/grow?section=customers', permanent: false },
      { source: '/portal/network', destination: '/portal/grow?section=network', permanent: false },
      { source: '/portal/network/:path*', destination: '/portal/grow?section=network', permanent: false },
      { source: '/portal/activity', destination: '/dashboard', permanent: false },
      { source: '/portal/activity/:path*', destination: '/dashboard', permanent: false },
      { source: '/portal/templates', destination: '/portal/materials?tab=templates', permanent: false },
      { source: '/portal/templates/:path*', destination: '/portal/materials?tab=templates', permanent: false },
    ]
  },

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
