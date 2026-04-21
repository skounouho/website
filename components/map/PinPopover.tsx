"use client";

import { useState } from "react";
import Link from "next/link";
import type { MapPin } from "@/lib/content";
import type { PinCluster } from "@/lib/cluster";
import { formatYearMonthRange } from "@/lib/format";

interface Props {
  /**
   * Currently-selected cluster, or null when the sidebar should be closed.
   * Always-mounted: the sidebar stays in the tree so slide/fade transitions
   * can run in both directions.
   */
  cluster: PinCluster | null;
  onClose: () => void;
}

export function PinPopover({ cluster, onClose }: Props) {
  // Preserve the last non-null cluster so content stays visible through the
  // exit transition. Derive synchronously in render — using an effect would
  // flash an empty panel on the first open.
  const [displayed, setDisplayed] = useState<PinCluster | null>(cluster);
  if (cluster && cluster !== displayed) setDisplayed(cluster);

  const isOpen = cluster !== null;
  const headingId = displayed ? `cluster-${displayed.id}-title` : undefined;
  const isMulti = (displayed?.pins.length ?? 0) > 1;

  return (
    <aside
      role="group"
      aria-labelledby={headingId}
      aria-hidden={!isOpen}
      onClick={(e) => e.stopPropagation()}
      className={[
        "fixed right-6 top-1/2 z-10 flex flex-col",
        "w-[420px] max-w-[calc(100vw-3rem)] max-h-[85vh]",
        "border rounded-[2px] shadow-sm",
        "-translate-y-1/2",
        "transition-[transform,opacity] duration-[280ms] ease-out",
        "motion-reduce:transition-opacity motion-reduce:duration-[120ms]",
        isOpen
          ? "translate-x-0 opacity-100"
          : "opacity-0 pointer-events-none motion-safe:translate-x-[calc(100%+1.5rem)]",
      ].join(" ")}
      style={{
        background: "var(--bg)",
        borderColor: "var(--border)",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="font-sans absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center text-lg"
        style={{ color: "var(--fg-muted)" }}
      >
        ×
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 pr-10">
        {displayed ? (
          <>
            <h3 id={headingId} className="font-sans text-[22px] font-bold">
              {displayed.name}
            </h3>
            {isMulti ? (
              <ul className="mt-4 flex flex-col">
                {displayed.pins.map((pin, i) => (
                  <li
                    key={pin.id}
                    className={i > 0 ? "mt-5 border-t pt-5" : ""}
                    style={{ borderColor: "var(--border)" }}
                  >
                    <EventBlock pin={pin} showName />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2">
                <EventBlock pin={displayed.pins[0]} showName={false} />
              </div>
            )}
          </>
        ) : null}
      </div>
    </aside>
  );
}

function EventBlock({ pin, showName }: { pin: MapPin; showName: boolean }) {
  const rangeText =
    pin.start && pin.end !== undefined
      ? formatYearMonthRange(pin.start, pin.end ?? null)
      : null;

  return (
    <>
      <div className="flex items-center gap-2">
        {showName ? (
          <span className="font-sans text-[15px] font-bold">{pin.name}</span>
        ) : null}
        <span
          className="font-sans border px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
          style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}
        >
          {pin.kind}
        </span>
      </div>
      {rangeText ? (
        <div
          className="font-serif mt-1 text-sm"
          style={{ color: "var(--fg-muted)" }}
        >
          {rangeText}
        </div>
      ) : null}
      {pin.description ? (
        <div className="font-serif mt-2 space-y-2 text-[15px]">
          {pin.description.split(/\n{2,}/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      ) : null}
      {pin.links.length > 0 ? (
        <ul className="font-serif mt-2 flex flex-col gap-1 text-sm">
          {pin.links.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {pin.blog_slugs.length > 0 ? (
        <div className="mt-3">
          <h4 className="font-sans text-[14px] font-bold">Related writing</h4>
          <ul className="font-serif mt-1 flex flex-col gap-1 text-sm">
            {pin.blog_slugs.map((slug) => (
              <li key={slug}>
                <Link href={`/blog/${slug}`}>{slug}</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
