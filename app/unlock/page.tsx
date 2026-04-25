import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  UNLOCK_COOKIE_NAME,
  signUnlockToken,
  verifyUnlockToken,
} from "@/lib/auth/site-gate";

export const metadata: Metadata = {
  title: "Unlock",
  robots: { index: false, follow: false },
};

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function safeNextPath(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  // Only allow same-origin absolute paths. Reject protocol-relative and
  // anything that isn't a single-leading-slash path.
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

async function unlockAction(formData: FormData) {
  "use server";
  const password = process.env.SITE_PASSWORD;
  const submitted = formData.get("password");
  const next = safeNextPath(formData.get("next"));

  if (!password || typeof submitted !== "string" || submitted !== password) {
    const params = new URLSearchParams({ error: "1" });
    if (next !== "/") params.set("next", next);
    redirect(`/unlock?${params.toString()}`);
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: UNLOCK_COOKIE_NAME,
    value: signUnlockToken(password),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });

  redirect(next);
}

interface SearchParams {
  next?: string;
  error?: string;
}

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNextPath(rawNext);

  // If the user is already unlocked, send them along.
  const password = process.env.SITE_PASSWORD;
  if (password) {
    const cookieStore = await cookies();
    const token = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;
    if (verifyUnlockToken(token, password)) redirect(next);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form
        action={unlockAction}
        className="font-sans w-full max-w-xs flex flex-col gap-6"
        noValidate
      >
        <label htmlFor="password" className="text-sm text-[var(--fg-muted)]">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "unlock-error" : undefined}
          className="
            font-sans text-base bg-transparent
            border-0 border-b border-[var(--border)]
            py-2 px-0 focus:border-[var(--accent)]
            focus-visible:outline-none
            transition-colors duration-[120ms]
          "
        />
        <input type="hidden" name="next" value={next} />
        {error ? (
          <p id="unlock-error" className="text-sm text-[var(--fg-muted)]">
            Incorrect password.
          </p>
        ) : null}
        <button
          type="submit"
          className="
            self-start text-sm tracking-wide
            text-[var(--fg-muted)] hover:text-[var(--accent)]
            transition-colors duration-[120ms]
          "
        >
          Enter →
        </button>
      </form>
    </div>
  );
}
