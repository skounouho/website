import type { ReactNode } from "react";

export function PullQuote({ children }: { children?: ReactNode }) {
  return (
    <aside
      className="font-serif my-12 border-y py-8 text-center text-[1.55em] italic leading-snug"
      style={{ borderColor: "var(--border)" }}
    >
      {children}
    </aside>
  );
}
