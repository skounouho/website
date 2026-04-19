/*
 * An href is "external" (needs <a target="_blank"> rather than <Link>) if it
 * begins with a URL scheme (http:, https:, mailto:, tel:, etc.) or uses a
 * protocol-relative prefix (//cdn.example.com).
 */
export function isExternalHref(href: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}
