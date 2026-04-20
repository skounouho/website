"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { PinPopover } from "./PinPopover";

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
  const prefersReducedMotion = usePrefersReducedMotion();
  const [rotation, setRotation] = useState<[number, number]>(initialRotation);
  const [scale] = useState<number>(initialScale);
  const [mode, setMode] = useState<"auto" | "user" | "flying">(
    prefersReducedMotion ? "user" : "auto",
  );
  const [openPinId, setOpenPinId] = useState<string | null>(null);

  const { countryPaths, statePaths, projectedPins } = useMemo(() => {
    const projection = createGlobeProjection({
      width: GLOBE_WIDTH,
      height: GLOBE_HEIGHT,
      scale,
      rotation,
    });
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
        if (!isPinVisible(pin, rotation)) return null;
        return { pin, x: xy[0], y: xy[1] };
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenPinId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (mode !== "auto") return;
    let rafId = 0;
    const tick = () => {
      setRotation(([lon, lat]) => [(lon + 0.05) % 360, lat]);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [mode]);

  const openPin = projectedPins.find((p) => p.pin.id === openPinId) ?? null;

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startRotation: [number, number];
  } | null>(null);
  const pendingRotationRef = useRef<[number, number] | null>(null);
  const rafRef = useRef<number | null>(null);

  function flushPendingRotation() {
    if (pendingRotationRef.current) {
      setRotation(pendingRotationRef.current);
      pendingRotationRef.current = null;
    }
    rafRef.current = null;
  }

  function scheduleRotation(next: [number, number]) {
    pendingRotationRef.current = next;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushPendingRotation);
    }
  }

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      className="relative h-[calc(100vh-56px)] md:h-screen w-full overflow-hidden touch-none"
      style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
      onPointerDown={(e) => {
        // Ignore clicks on pins — those open popovers.
        if ((e.target as HTMLElement).closest("[data-pin]")) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          startRotation: rotation,
        };
        setMode("user");
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const dLon = dx * (180 / (scale * GLOBE_BASE_RADIUS));
        const dLat = -dy * (180 / (scale * GLOBE_BASE_RADIUS));
        const nextLon = drag.startRotation[0] + dLon;
        const nextLat = Math.max(-90, Math.min(90, drag.startRotation[1] + dLat));
        scheduleRotation([nextLon, nextLat]);
      }}
      onPointerUp={(e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-pin]")) return;
        setOpenPinId(null);
      }}
    >
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
              key={`c-${i}-${d.length}`}
              d={d}
              fill="none"
              stroke="var(--fg-muted)"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <g style={{ opacity: shouldShowStateBorders(scale) ? 0.6 : 0, transition: "opacity 150ms ease" }}>
          {statePaths.map((d, i) => (
            <path
              key={`s-${i}-${d.length}`}
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
              style={{ cursor: "pointer" }}
              aria-label={pin.name}
              onClick={(e) => {
                e.stopPropagation();
                setOpenPinId((prev) => (prev === pin.id ? null : pin.id));
              }}
            />
          ))}
        </g>
      </svg>

      {openPin ? (
        <PinPopover
          pin={openPin.pin}
          x={(openPin.x / GLOBE_WIDTH) * 100}
          y={(openPin.y / GLOBE_HEIGHT) * 100}
          onClose={() => setOpenPinId(null)}
        />
      ) : null}
    </div>
  );
}

function usePrefersReducedMotion(): boolean {
  // Read on mount. Not reactive to changes — matches the site's
  // other motion-gated features (MapSwitcher used the same pattern).
  const [reduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  return reduced;
}
