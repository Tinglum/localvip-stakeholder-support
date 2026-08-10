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
export function toProxiedMaterialUrl(
  src: string | null | undefined,
  /**
   * Directory to complete a BARE stored filename with, e.g. '/uploads/logos'.
   * Some columns store only "f5f749e1-....png" with no path; without this such a
   * value was returned unchanged and the browser resolved it against the current
   * page, producing a 404. Only the caller knows which folder its column means,
   * so this helper never guesses one.
   */
  bareFileDir?: string,
): string {
  if (!src) return ''
  if (src.startsWith('data:') || src.startsWith('blob:')) return src
  if (src.includes('/api/qa/material-proxy')) return src
  // Server-relative QA path or any absolute URL → proxy it.
  if (src.startsWith('/uploads/') || /^https?:\/\//i.test(src)) {
    return `/api/qa/material-proxy?url=${encodeURIComponent(src)}`
  }
  // Plain string checks rather than a regex: an earlier attempt used
  // /^[^/\]+\.[A-Za-z0-9]{2,5}$/ where the backslash escaped the closing
  // bracket, so the character class never closed and nothing ever matched.
  const isBareFilename =
    !src.includes('/') && !src.includes('\\') && /\.[A-Za-z0-9]{2,5}$/.test(src)
  if (bareFileDir && isBareFilename) {
    const dir = bareFileDir.replace(/\/+$/, '')
    return `/api/qa/material-proxy?url=${encodeURIComponent(`${dir}/${src}`)}`
  }

  // Other same-origin relative paths (e.g. /api/qa/material-asset) pass through.
  return src
}
