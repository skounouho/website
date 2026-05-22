import type { ReactNode } from "react";

/**
 * A spoken exchange, laid out as a screenplay: speaker labels in a left
 * column, lines in the right. The `<dl>` is the grid, so every `<Line>`'s
 * speaker column aligns to the widest name across the whole exchange.
 */
export function Dialogue({ children }: { children?: ReactNode }) {
  return (
    <dl className="my-7 grid grid-cols-[max-content_1fr] items-baseline gap-x-5 gap-y-3">
      {children}
    </dl>
  );
}

/**
 * One speaker's line within a <Dialogue>. Renders a <dt>/<dd> pair directly
 * into the parent grid, so the fragment — not a wrapper — is what `<dl>`
 * lays out.
 */
export function Line({
  speaker,
  children,
}: {
  speaker: string;
  children?: ReactNode;
}) {
  return (
    <>
      <dt
        className="font-sans text-[0.72em] font-bold uppercase tracking-[0.08em]"
        style={{ color: "var(--fg-muted)" }}
      >
        {speaker}
      </dt>
      <dd className="m-0 [&_p]:m-0">{children}</dd>
    </>
  );
}
