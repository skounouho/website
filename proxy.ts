import { NextResponse, type NextRequest } from "next/server";
import { UNLOCK_COOKIE_NAME, verifyUnlockToken } from "@/lib/auth/site-gate";

export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;

  // Gate disabled when SITE_PASSWORD is unset (local dev convenience).
  if (!password) return NextResponse.next();

  const token = request.cookies.get(UNLOCK_COOKIE_NAME)?.value;
  if (verifyUnlockToken(token, password)) return NextResponse.next();

  const url = request.nextUrl;
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
