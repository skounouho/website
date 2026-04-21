"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import type { PinCluster } from "@/lib/cluster";

interface Props {
  cluster: PinCluster;
  x: number;
  y: number;
  onActivate: (cluster: PinCluster) => void;
}

/**
 * One pin dot on the globe, representing a cluster of one or more underlying
 * MapPins. A focus ring (visible only on keyboard focus) sits behind the
 * interactive accent-colored circle. Activation (click or Enter/Space)
 * delegates to `onActivate`, which MapGlobe routes into its flyTo/popover
 * logic.
 */
export function GlobePin({ cluster, x, y, onActivate }: Props) {
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

  return (
    <g
      tabIndex={0}
      role="button"
      aria-label={cluster.name}
      className="group outline-none"
      style={{ cursor: "pointer" }}
      onKeyDown={handleKeyDown}
    >
      <circle
        cx={x}
        cy={y}
        r={8}
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
        r={4.8}
        fill="var(--accent)"
        stroke="var(--bg)"
        strokeWidth={1.6}
        onClick={handleClick}
      />
    </g>
  );
}
