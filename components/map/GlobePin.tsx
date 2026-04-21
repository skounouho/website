"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import type { PinCluster } from "@/lib/cluster";

interface Props {
  cluster: PinCluster;
  x: number;
  y: number;
  onActivate: (cluster: PinCluster) => void;
  onHoverChange?: (id: string | null) => void;
}

// Invisible hit target radius. Bigger than the focus ring (6.912) so clicks
// slightly off the visible dot still register as pin clicks instead of
// falling through to the globe below (which would close the open popover).
const HIT_TARGET_RADIUS = 11;

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
  onActivate,
  onHoverChange,
}: Props) {
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
        r={6.912}
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
        r={4.1472}
        fill={fill}
        stroke="var(--bg)"
        strokeWidth={1}
        pointerEvents="none"
      />
      <circle
        cx={x}
        cy={y}
        r={HIT_TARGET_RADIUS}
        fill="transparent"
        aria-hidden="true"
      />
    </g>
  );
}
