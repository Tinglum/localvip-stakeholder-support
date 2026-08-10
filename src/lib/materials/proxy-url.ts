/**
 * Route a remote material asset (PDF/image hosted on qa.localvip.com) through
 * this origin's same-origin proxy so the browser will fetch/render it without
 * cross-origin restrictions.
 *
 * - Data URLs and blob URLs are already local — returned unchanged.
 * - Server-relative paths (/uploads/...) and absolute http(s) URLs are wrapped
 *   in `/api/qa/material-proxy?url=<encoded>`. The proxy only forwards
 *   qa.localvip.com /uploads/* assets, so other absolute URLs that aren't on QA
 *   will simply 403 there (and the caller's fallback handles it).
 *
 * Already-proxied URLs (containing the proxy path) pass through untouched so we
 * never double-wrap.
 */
export function toProxiedMaterialUrl(src: string | null | undefined): string {
  if (!src) return ''
  if (src.startsWith('data:') || src.startsWith('blob:')) return src
  if (src.includes('/api/qa/material-proxy')) return src
  // Server-relative QA path or any absolute URL → proxy it.
  if (src.startsWith('/uploads/') || /^https?:\/\//i.test(src)) {
    return `/api/qa/material-proxy?url=${encodeURIComponent(src)}`
  }
  // A bare stored filename, which is how Accounts.ImageUrl holds a business logo
  // ("f5f749e1-....png", no path). Previously this fell through and was returned
  // unchanged, so the browser resolved it against the current page - e.g.
  // /portal/f5f749e1-....png - and 404'd. Logos are served from /uploads/logos
  // on the QA host, so complete the path and proxy it like any other upload.
  if (/^[\w.-]+\.(png|jpe?g|gif|webp|svg)$/i.test(src)) {
    return `/api/qa/material-proxy?url=${encodeURIComponent(`/uploads/logos/${src}`)}`
  }

  // Other same-origin relative paths (e.g. /api/qa/material-asset) pass through.
  return src
}
