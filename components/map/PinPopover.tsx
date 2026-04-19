"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
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
  const ref = useRef<HTMLDivElement>(null);
  // Flip above/below based on vertical position within the map.
  const placement: "above" | "below" = y < 25 ? "below" : "above";

  useEffect(() => {
    const node = ref.current;
    if (node) node.focus();
  }, []);

  const headingId = `pin-${pin.id}-title`;
  const rangeText =
    pin.start && pin.end !== undefined
      ? formatYearMonthRange(pin.start, pin.end ?? null)
      : null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={headingId}
      tabIndex={-1}
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
        <h3
          id={headingId}
          className="text-[20px] font-medium"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {pin.name}
        </h3>
        <span
          className="border px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
          style={{
            borderColor: "var(--border)",
            color: "var(--fg-muted)",
            fontFamily: "var(--font-sans)",
          }}
        >
          {pin.kind}
        </span>
      </div>
      {rangeText ? (
        <div
          className="mt-1 text-sm"
          style={{ color: "var(--fg-muted)", fontFamily: "var(--font-serif)" }}
        >
          {rangeText}
        </div>
      ) : null}
      {pin.description ? (
        <div
          className="mt-3 space-y-2 text-[15px]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {pin.description.split(/\n{2,}/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      ) : null}
      {pin.links.length > 0 ? (
        <ul
          className="mt-3 flex flex-col gap-1 text-sm"
          style={{ fontFamily: "var(--font-serif)" }}
        >
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
          <h4
            className="text-[16px] font-medium"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Related writing
          </h4>
          <ul
            className="mt-1 flex flex-col gap-1 text-sm"
            style={{ fontFamily: "var(--font-serif)" }}
          >
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
        className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center"
        style={{
          color: "var(--fg-muted)",
          fontFamily: "var(--font-sans)",
        }}
      >
        ×
      </button>
    </div>
  );
}
