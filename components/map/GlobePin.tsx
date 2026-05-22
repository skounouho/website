"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import type { PinCluster } from "@/lib/cluster";

interface Props {
  cluster: PinCluster;
  x: number;
  y: number;
  /** Touch device — pins render larger and grow with zoom (see `scale`). */
  coarse?: boolean;
  /** Current globe zoom; on touch devices pin radii scale with it. */
  scale?: number;
  onActivate: (cluster: PinCluster) => void;
  onHoverChange?: (id: string | null) => void;
}

// Pin radii in viewBox units. `hit` is the invisible tap/click target — kept
// larger than `ring` so taps slightly off the visible dot still register as
// pin hits instead of falling through to the globe (which would close the
// open popover).
const FINE_RADII = { dot: 4.1472, ring: 6.912, hit: 11 };

// Touch pins use these as their scale-1 size and grow with the globe zoom.
// The globe renders small on phones, so a fixed dot is hard to tap — but a
// fixed *large* dot would clutter the zoomed-out overview. Growing with zoom
// keeps the overview clean and makes pins comfortably tappable once zoomed.
const COARSE_BASE_RADII = { dot: 8, ring: 13, hit: 21 };

// Past this zoom the multiplier stops climbing: pins hold a constant size
// while the globe keeps zooming, so tightly-packed pins pull apart instead
// of overlapping.
const COARSE_ZOOM_CAP = 2.5;

function pinRadii(coarse: boolean, scale: number) {
  if (!coarse) return FINE_RADII;
  const m = Math.min(scale, COARSE_ZOOM_CAP);
  return {
    dot: COARSE_BASE_RADII.dot * m,
    ring: COARSE_BASE_RADII.ring * m,
    hit: COARSE_BASE_RADII.hit * m,
  };
}

/**
 * One pin dot on the globe, representing a cluster of one or more underlying
 * MapPins. A focus ring (visible only on keyboard focus) sits behind the
 * interactive accent-colored circle. Park clusters paint in a muted teal.
 * Activation (click or Enter/Space) delegates to `onActivate`; hover/focus
 * notifies MapGlobe via `onHoverChange` so it can sort the pin last and
 * bring it to the front of the SVG paint order.
 */
export function GlobePin({
  cluster,
  x,
  y,
  coarse = false,
  scale = 1,
  onActivate,
  onHoverChange,
}: Props) {
  const r = pinRadii(coarse, scale);

  const handleKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    onActivate(cluster);
  };

  const handleClick = (e: MouseEvent<SVGGElement>) => {
    e.stopPropagation();
    onActivate(cluster);
  };

  const isPark = cluster.pins.every((p) => p.kind === "park");
  const fill = isPark ? "var(--accent-park)" : "var(--accent)";

  return (
    <g
      tabIndex={0}
      role="button"
      aria-label={cluster.name}
      data-pin={cluster.id}
      className="group outline-none"
      style={{ cursor: "pointer" }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onPointerEnter={() => onHoverChange?.(cluster.id)}
      onPointerLeave={() => onHoverChange?.(null)}
      onFocus={() => onHoverChange?.(cluster.id)}
      onBlur={() => onHoverChange?.(null)}
    >
      <circle
        cx={x}
        cy={y}
        r={r.ring}
        fill="none"
        stroke="var(--fg-muted)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
        className="opacity-0 group-focus-visible:opacity-100 transition-opacity duration-[var(--duration-fast)]"
        aria-hidden="true"
      />
      <circle
        cx={x}
        cy={y}
        r={r.dot}
        fill={fill}
        stroke="var(--bg)"
        strokeWidth={1}
        pointerEvents="none"
      />
      <circle
        cx={x}
        cy={y}
        r={r.hit}
        fill="transparent"
        aria-hidden="true"
      />
    </g>
  );
}
