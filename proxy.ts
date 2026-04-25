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
  matcher: [
    // Gate everything except the unlock route and the assets it needs to render.
    "/((?!unlock|_next/static|_next/image|favicon\\.ico|icon\\.svg).*)",
  ],
};
