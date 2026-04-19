import type { ReactNode } from "react";

export function PullQuote({ children }: { children?: ReactNode }) {
  return (
    <aside
      className="my-12 border-y py-8 text-center text-[1.55em] italic leading-snug"
      style={{ borderColor: "var(--border)", fontFamily: "var(--font-serif)" }}
    >
      {children}
    </aside>
  );
}
