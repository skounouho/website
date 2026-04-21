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

  const handleClick = (e: MouseEvent<SVGCircleElement>) => {
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
      className="group outline-none"
      style={{ cursor: "pointer" }}
      onKeyDown={handleKeyDown}
      onPointerEnter={() => onHoverChange?.(cluster.id)}
      onPointerLeave={() => onHoverChange?.(null)}
      onFocus={() => onHoverChange?.(cluster.id)}
      onBlur={() => onHoverChange?.(null)}
    >
      <circle
        cx={x}
        cy={y}
        r={7.2}
        fill="none"
        stroke="var(--fg-muted)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        className="opacity-0 group-focus-visible:opacity-100 transition-opacity duration-[var(--duration-fast)]"
        aria-hidden="true"
      />
      <circle
        data-pin={cluster.id}
        cx={x}
        cy={y}
        r={4.32}
        fill={fill}
        stroke="var(--bg)"
        strokeWidth={1}
        onClick={handleClick}
      />
    </g>
  );
}
