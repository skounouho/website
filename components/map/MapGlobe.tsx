"use client";

import { useMemo } from "react";
import type { ExtendedFeatureCollection } from "d3-geo";
import type { MapPin } from "@/lib/content";
import {
  createGlobeProjection,
  pathsFromGeojson,
  isPinVisible,
  shouldShowStateBorders,
  GLOBE_WIDTH,
  GLOBE_HEIGHT,
  GLOBE_BASE_RADIUS,
} from "@/lib/projection";

export interface MapGlobeProps {
  pins: MapPin[];
  worldFeatures: ExtendedFeatureCollection;
  stateFeatures: ExtendedFeatureCollection;
  initialRotation: [number, number];
  initialScale: number;
  initialCountryPaths: string[];
}

export function MapGlobe({
  pins,
  worldFeatures,
  stateFeatures,
  initialRotation,
  initialScale,
  initialCountryPaths,
}: MapGlobeProps) {
  const rotation = initialRotation;
  const scale = initialScale;

  const { countryPaths, statePaths, projectedPins } = useMemo(() => {
    const projection = createGlobeProjection({
      width: GLOBE_WIDTH,
      height: GLOBE_HEIGHT,
      scale,
      rotation,
    });
    // On first render, reuse the SSR paths instead of re-computing.
    const isInitial =
      rotation[0] === initialRotation[0] &&
      rotation[1] === initialRotation[1] &&
      scale === initialScale;
    const countryPaths = isInitial
      ? initialCountryPaths
      : pathsFromGeojson(worldFeatures, projection);
    const statePaths = shouldShowStateBorders(scale)
      ? pathsFromGeojson(stateFeatures, projection)
      : [];
    const projectedPins = pins
      .map((pin) => {
        const xy = projection([pin.lon, pin.lat]);
        if (!xy) return null;
        const visible = isPinVisible(pin, rotation);
        return visible ? { pin, x: xy[0], y: xy[1] } : null;
      })
      .filter((p): p is { pin: MapPin; x: number; y: number } => p !== null);
    return { countryPaths, statePaths, projectedPins };
  }, [
    rotation,
    scale,
    worldFeatures,
    stateFeatures,
    pins,
    initialCountryPaths,
    initialRotation,
    initialScale,
  ]);

  return (
    <div className="relative h-[calc(100vh-56px)] md:h-screen w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${GLOBE_WIDTH} ${GLOBE_HEIGHT}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Interactive globe showing places I've lived, worked, and visited."
      >
        <circle
          cx={GLOBE_WIDTH / 2}
          cy={GLOBE_HEIGHT / 2}
          r={GLOBE_BASE_RADIUS * scale}
          fill="var(--border)"
          stroke="var(--fg-muted)"
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
        />
        <g>
          {countryPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="var(--fg-muted)"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <g
          style={{
            opacity: shouldShowStateBorders(scale) ? 0.6 : 0,
            transition: "opacity 150ms ease",
          }}
        >
          {statePaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="var(--fg-muted)"
              strokeWidth={0.4}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <g>
          {projectedPins.map(({ pin, x, y }) => (
            <circle
              key={pin.id}
              data-pin={pin.id}
              cx={x}
              cy={y}
              r={6}
              fill="var(--accent)"
              stroke="var(--bg)"
              strokeWidth={2}
              aria-label={pin.name}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
