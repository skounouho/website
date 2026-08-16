"use client";

import { useEffect, useState } from "react";

type Status = "idle" | "copied" | "failed";

const LABELS: Record<Status, string> = {
  idle: "Share this",
  copied: "Link copied",
  failed: "Press ⌘C to copy",
};

/**
 * Copies the post's share URL — which carries a token that lets someone past
 * the site password for this post alone. Falls back to selectable text when
 * the clipboard is unavailable.
 */
export function ShareLink({ url }: { url: string }) {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (status !== "copied") return;
    const timer = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <span className="font-sans text-sm">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setStatus("copied");
          } catch {
            setStatus("failed");
          }
        }}
        className="bg-transparent text-[color:var(--fg-muted)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:text-[color:var(--accent)]"
      >
        <span aria-live="polite">{LABELS[status]}</span>
      </button>
      {status === "failed" ? (
        <input
          readOnly
          autoFocus
          value={url}
          aria-label="Share link"
          onFocus={(event) => event.currentTarget.select()}
          className="mt-2 block w-full bg-transparent text-[color:var(--fg-muted)] focus-visible:outline-none"
        />
      ) : null}
    </span>
  );
}
