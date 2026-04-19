"use client";

import Link from "next/link";
import type { MapPin } from "@/lib/content";
import { formatYearMonthRange } from "@/lib/format";

interface Props {
  pin: MapPin;
  /** Pin x position as a percentage of the container width. */
  x: number;
  /** Pin y position as a percentage of the container height. */
  y: number;
  onClose: () => void;
}

export function PinPopover({ pin, x, y, onClose }: Props) {
  // Flip above/below based on vertical position within the map.
  const placement: "above" | "below" = y < 25 ? "below" : "above";

  const headingId = `pin-${pin.id}-title`;
  const rangeText =
    pin.start && pin.end !== undefined
      ? formatYearMonthRange(pin.start, pin.end ?? null)
      : null;

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      onClick={(e) => e.stopPropagation()}
      className="absolute z-10 w-[320px] max-w-[80vw] border p-5 shadow-sm"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, ${placement === "above" ? "-100%" : "0"}) translateY(${placement === "above" ? "-14px" : "14px"})`,
        background: "var(--bg)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center gap-3">
        <h3 id={headingId} className="font-sans text-[20px] font-medium">
          {pin.name}
        </h3>
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
        <div className="font-serif mt-3 space-y-2 text-[15px]">
          {pin.description.split(/\n{2,}/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      ) : null}
      {pin.links.length > 0 ? (
        <ul className="font-serif mt-3 flex flex-col gap-1 text-sm">
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
        <div className="mt-4">
          <h4 className="font-sans text-[16px] font-medium">
            Related writing
          </h4>
          <ul className="font-serif mt-1 flex flex-col gap-1 text-sm">
            {pin.blog_slugs.map((slug) => (
              <li key={slug}>
                <Link href={`/blog/${slug}`}>{slug}</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="font-sans absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center"
        style={{ color: "var(--fg-muted)" }}
      >
        ×
      </button>
    </div>
  );
}
