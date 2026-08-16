import { SITE_URL } from "@/lib/site-url";
import { SHARE_PARAM, signShareToken } from "./site-gate";

/**
 * Absolute URL for sharing a post with someone who does not have the site
 * password, or null when no working link can be produced.
 *
 * Three cases:
 *   - Gate off (no SITE_PASSWORD): the plain post URL already works.
 *   - Gate on with SITE_SHARE_SECRET: a token bound to this slug.
 *   - Gate on without a share secret: null, since any link we handed out
 *     would just dead-end at the password form.
 */
export function buildShareUrl(slug: string): string | null {
  const url = new URL(`/blog/${slug}`, SITE_URL);

  if (!process.env.SITE_PASSWORD) return url.toString();

  const secret = process.env.SITE_SHARE_SECRET;
  if (!secret) return null;

  url.searchParams.set(SHARE_PARAM, signShareToken(slug, secret));
  return url.toString();
}
