import { NextResponse, type NextRequest } from "next/server";
import {
  SHARE_PARAM,
  UNLOCK_COOKIE_NAME,
  shareableSlug,
  verifyShareToken,
  verifyUnlockToken,
} from "@/lib/auth/site-gate";

export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;

  // Gate disabled when SITE_PASSWORD is unset (local dev convenience).
  if (!password) return NextResponse.next();

  const token = request.cookies.get(UNLOCK_COOKIE_NAME)?.value;
  if (verifyUnlockToken(token, password)) return NextResponse.next();

  const url = request.nextUrl;

  // A share link admits its own post and nothing else. Deliberately grants no
  // cookie: access lasts exactly as long as the token stays in the URL.
  const shareSecret = process.env.SITE_SHARE_SECRET;
  const slug = shareableSlug(url.pathname);
  if (shareSecret && slug) {
    const shareToken = url.searchParams.get(SHARE_PARAM);
    if (verifyShareToken(shareToken ?? undefined, slug, shareSecret)) {
      return NextResponse.next();
    }
  }

  const next = url.pathname + url.search;
  const unlock = new URL("/unlock", request.url);
  if (next && next !== "/") unlock.searchParams.set("next", next);
  return NextResponse.redirect(unlock);
}

export const config = {
  // Gate the blog index and every post (including OG images, so post titles
  // don't leak via social previews). The rest of the site stays public.
  matcher: ["/blog", "/blog/:path*"],
};
