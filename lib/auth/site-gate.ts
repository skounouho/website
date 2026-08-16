import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const UNLOCK_COOKIE_NAME = "site_unlock";

/** Query parameter carrying a per-post share token. */
export const SHARE_PARAM = "share";

const TOKEN_PREFIX = "v1:";
const SHARE_PREFIX = "share-v1:";

function hash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function constantTimeEquals(token: string, expected: string): boolean {
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function signUnlockToken(password: string): string {
  return hash(TOKEN_PREFIX + password);
}

export function verifyUnlockToken(
  token: string | undefined,
  password: string,
): boolean {
  if (!token || !password) return false;
  return constantTimeEquals(token, signUnlockToken(password));
}

/**
 * Mints a share token bound to a single post slug. Holding the token grants
 * access to that post only, and only while it stays in the URL — the proxy
 * sets no cookie in exchange for it.
 */
export function signShareToken(slug: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(SHARE_PREFIX + slug)
    .digest("hex");
}

export function verifyShareToken(
  token: string | undefined,
  slug: string,
  secret: string,
): boolean {
  if (!token || !slug || !secret) return false;
  return constantTimeEquals(token, signShareToken(slug, secret));
}

/**
 * Returns the slug a share token would have to be signed for to unlock this
 * path, or null if the path is not a single post. Deeper paths under a post
 * (the OG image route, say) return null, so a share link never widens past
 * the post itself.
 */
export function shareableSlug(pathname: string): string | null {
  const match = /^\/blog\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}
