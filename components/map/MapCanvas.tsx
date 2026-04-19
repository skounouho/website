"use client";

import { useEffect, useRef, useState } from "react";
import type { MapPin } from "@/lib/content";
import { PinPopover } from "./PinPopover";

export interface ProjectedPin {
  pin: MapPin;
  x: number;
  y: number;
}

interface Props {
  viewBox: string;
  width: number;
  height: number;
  countryPaths: string[];
  pins: ProjectedPin[];
}

export function MapCanvas({
  viewBox,
  width,
  height,
  countryPaths,
  pins,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [shiftX, setShiftX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Hash linking: open the matching pin on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tryOpen = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const match = pins.find((p) => p.pin.id === hash);
      if (!match) {
        history.replaceState(null, "", window.location.pathname);
        return;
      }
      setOpenId(match.pin.id);
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const wantCenter = rect.width / 2;
        const actualX = (match.x / width) * rect.width;
        setShiftX(wantCenter - actualX);
      }
    };
    tryOpen();
    window.addEventListener("hashchange", tryOpen);
    return () => window.removeEventListener("hashchange", tryOpen);
  }, [pins, width]);

  // Close popover on Escape or outside click handled by PinPopover.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-full overflow-hidden"
      onClick={(e) => {
        // Outside-click close: only if the click didn't land on a pin.
        if ((e.target as HTMLElement).closest("[data-pin]")) return;
        setOpenId(null);
      }}
    >
      <svg
        viewBox={viewBox}
        className="absolute inset-0 h-full w-full transition-transform motion-safe:duration-[var(--duration-medium)]"
        style={{ transform: `translateX(${shiftX}px)` }}
        aria-label="World map"
        role="img"
      >
        <g>
          {countryPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="var(--border)"
              stroke="var(--fg-muted)"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <g>
          {pins.map(({ pin, x, y }) => (
            <g key={pin.id} transform={`translate(${x} ${y})`}>
              <circle
                data-pin={pin.id}
                r={6}
                fill="var(--accent)"
                stroke="var(--bg)"
                strokeWidth={2}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenId((prev) => (prev === pin.id ? null : pin.id));
                }}
                aria-label={pin.name}
              />
            </g>
          ))}
        </g>
      </svg>

      {pins.map(({ pin, x, y }) =>
        openId === pin.id ? (
          <PinPopover
            key={pin.id}
            pin={pin}
            x={(x / width) * 100}
            y={(y / height) * 100}
            onClose={() => setOpenId(null)}
          />
        ) : null,
      )}
    </div>
  );
}
